/**
 * AEGIS — MCP (Model Context Protocol) Server
 *
 * Exposes AEGIS orchestration capabilities as MCP tools that external
 * AI assistants (Claude Desktop, Cursor, etc.) can call.
 *
 * Run standalone with stdio transport:
 *   npx tsx src/mcp/entry.ts
 *   npm run mcp
 *
 * Or integrate into the Express app with SSE transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';
import prisma, { initDatabase } from '../db';
import { defaultOrganizationId, ensureDefaultOrganization, redactSensitiveSettings } from '../middleware/auth';
import { getLLMConfig } from '../services/llmConfig';
import { runMission, getMissionOutputDir } from '../orchestrator';
import { generateEmbedding } from '../services/embedding';
import { childLogger } from '../utils/logger';
import {
  DESIGN_ANALYSIS_SYSTEM,
  buildDesignPrompt,
  tokensToCSSVariables,
  DEFAULT_TOKENS,
} from '../services/designParser';

const log = childLogger('mcp');

// =============================================================================
// Helpers
// =============================================================================

/**
 * Initialize the database before starting the MCP server.
 */
export async function initialize(): Promise<void> {
  await initDatabase();
  log.info('Database initialized for MCP server');
}

/**
 * Call the LLM with retry logic (matches orchestrator pattern).
 */
async function callLLM(system: string, userPrompt: string, temp = 0.3, retries = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const orgId = defaultOrganizationId || await ensureDefaultOrganization();
      const cfg = await getLLMConfig(orgId);
      if (!cfg.apiKey) throw new Error('No API key configured');

      const openai = new OpenAI({
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
        defaultHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'AEGIS' },
      });

      const resp = await openai.chat.completions.create({
        model: cfg.model,
        temperature: temp,
        max_tokens: 8192,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      });

      const text = resp.choices[0]?.message?.content || '';
      if (!text.trim()) throw new Error('Empty response from LLM');
      return text;
    } catch (err: unknown) {
      lastErr = err;
      const apiError = err as { message?: string; status?: number; response?: { status?: number }; code?: string };
      const msg = apiError.message || '';
      const status = apiError.status || apiError.response?.status || 0;
      const is429 = status === 429 || msg.includes('429');
      const isTransient = apiError.code === 'ECONNRESET' || apiError.code === 'ETIMEDOUT' || status === 502 || status === 503 || is429;
      if (isTransient && i < retries - 1) {
        const delay = is429 ? 30000 : 3000 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('All retries exhausted');
}

/**
 * Parse JSON from an LLM response (strips code fences).
 */
function parseJSON(text: string): Record<string, unknown> {
  const blockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1]); } catch { /* fall through */ }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  throw new Error('Could not parse JSON from LLM response');
}

// =============================================================================
// Tool Implementations (shared between tool() and direct usage)
// =============================================================================

export async function handleCreateMission(args: { idea: string; organizationId?: string }) {
  try {
    const id = uuidv4();
    const orgId = args.organizationId || defaultOrganizationId || await ensureDefaultOrganization();

    await prisma.project.create({
      data: { id, name: 'pending', idea: args.idea, status: 'running', organizationId: orgId },
    });

    log.info({ projectId: id, ideaLen: args.idea.length, orgId }, 'Mission created via MCP');

    // Run mission asynchronously
    runMission(id, args.idea).catch((err: Error) => {
      log.error({ err: err.message, projectId: id }, 'MCP-created mission failed');
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ id, status: 'running', idea: args.idea.slice(0, 100) }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: message, code: 'CREATE_FAILED' }, null, 2) }],
      isError: true,
    };
  }
}

export async function handleListMissions(args: { status?: string; limit?: number; organizationId?: string }) {
  const orgId = args.organizationId || defaultOrganizationId;
  const where: Record<string, unknown> = {};
  if (args.status) where.status = args.status;
  if (orgId) where.organizationId = orgId;

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: args.limit ?? 20,
    select: {
      id: true,
      name: true,
      status: true,
      idea: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ missions: projects, count: projects.length }, null, 2) }],
  };
}

export async function handleGetMission(args: { projectId: string }) {
  const project = await prisma.project.findUnique({
    where: { id: args.projectId },
  });

  if (!project) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Mission not found', code: 'NOT_FOUND' }, null, 2) }],
      isError: true,
    };
  }

  const logs = await prisma.projectLog.findMany({
    where: { projectId: args.projectId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  const zipPath = project.outputPath && fs.existsSync(project.outputPath) ? project.outputPath : null;

  const outDir = getMissionOutputDir(args.projectId);
  const fileTree: string[] = [];
  if (fs.existsSync(outDir)) {
    const walk = (dir: string, prefix = ''): void => {
      for (const item of fs.readdirSync(dir)) {
        if (item.startsWith('.')) continue; // skip hidden files
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          if (!['node_modules', '.git', '.next', 'dist'].includes(item)) {
            fileTree.push(prefix + item + '/');
            walk(full, prefix + '  ');
          }
        } else {
          fileTree.push(prefix + item);
        }
      }
    };
    walk(outDir);
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
          idea: project.idea,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        logs: logs.map((l) => ({
          agent: l.agent,
          message: l.message,
          type: l.type,
          timestamp: l.createdAt,
        })),
        artifact: zipPath ? { path: zipPath, exists: true } : null,
        outputFiles: fileTree,
      }, null, 2),
    }],
  };
}

export async function handleDeleteMission(args: { projectId: string; confirm: boolean }) {
  if (!args.confirm) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Deletion requires confirm: true', code: 'CONFIRM_REQUIRED' }, null, 2) }],
      isError: true,
    };
  }

  const project = await prisma.project.findUnique({ where: { id: args.projectId } });
  if (!project) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Mission not found', code: 'NOT_FOUND' }, null, 2) }],
      isError: true,
    };
  }

  const outDir = getMissionOutputDir(args.projectId);
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  if (project.outputPath && fs.existsSync(project.outputPath)) {
    fs.unlinkSync(project.outputPath);
  }

  await prisma.project.delete({ where: { id: args.projectId } });

  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ success: true, deleted: args.projectId }, null, 2) }],
  };
}

export async function handleSearchKnowledge(args: {
  query: string;
  limit?: number;
  projectId?: string;
  source?: string;
  threshold?: number;
  organizationId?: string;
}) {
  try {
    const orgId = args.organizationId || defaultOrganizationId || await ensureDefaultOrganization();
    const queryVector = await generateEmbedding(args.query, orgId);

    const conditions: string[] = ['c.embedding IS NOT NULL'];
    const params: unknown[] = [];
    let paramIdx = 1;

    // Org-scoping
    conditions.push(`c.organization_id = $${paramIdx++}`);
    params.push(orgId);

    if (args.projectId) {
      conditions.push(`c.project_id = $${paramIdx++}`);
      params.push(args.projectId);
    }
    if (args.source) {
      conditions.push(`c.source = $${paramIdx++}`);
      params.push(args.source);
    }

    params.push(`[${queryVector.join(',')}]`);
    const queryVecParam = `$${paramIdx++}`;
    params.push(args.threshold ?? 0);
    const thresholdParam = `$${paramIdx++}`;
    const limit = args.limit ?? 10;
    params.push(limit);
    const limitParam = `$${paramIdx++}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        c.id,
        c.project_id AS "projectId",
        c.source,
        c.file_path AS "filePath",
        c.content,
        c.created_at AS "createdAt",
        1 - (c.embedding <=> ${queryVecParam}::vector) AS "score"
      FROM document_chunks c
      ${whereClause}
        AND 1 - (c.embedding <=> ${queryVecParam}::vector) >= ${thresholdParam}
      ORDER BY c.embedding <=> ${queryVecParam}::vector ASC
      LIMIT ${limitParam}
    `;

    const results = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ query: args.query, count: results.length, results }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: message, code: 'SEARCH_ERROR' }, null, 2) }],
      isError: true,
    };
  }
}

export async function handleAnalyzeDesign(args: { description: string; imageUrl?: string }) {
  try {
    const prompt = buildDesignPrompt(args.description, args.imageUrl);
    const rawResponse = await callLLM(DESIGN_ANALYSIS_SYSTEM, prompt, 0.4);
    const parsed = parseJSON(rawResponse);

    const tokens = (parsed.tokens as typeof DEFAULT_TOKENS) || DEFAULT_TOKENS;
    const cssVariables = tokensToCSSVariables(tokens);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        tokens,
        styleNotes: parsed.styleNotes || 'AI-generated design analysis.',
        componentSuggestions: parsed.componentSuggestions || ['HeroSection', 'FeatureCard', 'NavigationBar'],
        cssVariables,
      }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        error: message,
        fallback: true,
        tokens: DEFAULT_TOKENS,
      }, null, 2) }],
      isError: true,
    };
  }
}

export async function handleGetSettings(args?: { organizationId?: string }) {
  const orgId = args?.organizationId || defaultOrganizationId;

  const rows = await prisma.setting.findMany({
    where: orgId ? { organizationId: orgId } : undefined,
    select: { key: true, value: true },
  });

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  // Redact sensitive values (reuses shared redaction logic from auth middleware)
  const redacted = redactSensitiveSettings(settings);

  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ settings: redacted, count: Object.keys(settings).length }, null, 2) }],
  };
}

export async function handleUpdateSettings(args: { settings: Record<string, string>; organizationId?: string }) {
  try {
    const orgId = args.organizationId || defaultOrganizationId || await ensureDefaultOrganization();

    await prisma.$transaction(
      Object.entries(args.settings).map(([key, value]) =>
        prisma.setting.upsert({
          where: { organizationId_key: { organizationId: orgId, key } },
          update: { value },
          create: { organizationId: orgId, key, value },
        }),
      ),
    );

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        success: true,
        updated: Object.keys(args.settings).length,
        keys: Object.keys(args.settings),
      }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: JSON.stringify({ error: message, code: 'DB_ERROR' }, null, 2) }],
      isError: true,
    };
  }
}

// =============================================================================
// Schema Definitions (extracted to cap type instantiation depth)
// =============================================================================

const listMissionsSchema = {
  status: z.enum(['running', 'completed', 'failed']).optional().describe('Filter by mission status'),
  limit: z.number().min(1).max(100).default(20).describe('Maximum missions to return (default 20)'),
} satisfies Record<string, z.ZodType>;

const searchSchema = {
  query: z.string().min(1).describe('Natural language search query'),
  limit: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
  projectId: z.string().optional().describe('Limit search to a specific project'),
  source: z.enum(['idea', 'file', 'log']).optional().describe('Filter by document type'),
  threshold: z.number().min(0).max(1).default(0).describe('Minimum similarity threshold (higher = more relevant)'),
} satisfies Record<string, z.ZodType>;

const analyzeDesignSchema = {
  description: z.string().min(1).describe('Detailed description of the design — include colors, style, layout, target audience'),
  imageUrl: z.string().url().optional().describe('URL to a screenshot or design mockup for reference'),
} satisfies Record<string, z.ZodType>;

const updateSettingsSchema = {
  settings: z.record(z.string(), z.string()).describe('Object with setting keys and their new values'),
} satisfies Record<string, z.ZodType>;

const createMissionSchema = {
  idea: z.string().min(3).max(10000).describe('The natural language description of the project to build'),
} satisfies Record<string, z.ZodType>;

// =============================================================================
// MCP Server Factory
// =============================================================================

/**
 * Create and configure the MCP server with all AEGIS tools registered.
 */
export function createMCPServer(): McpServer {
  const server = new McpServer(
    {
      name: 'aegis',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ── Tool: List missions ──
  server.tool(
    'aegis_list_missions',
    'List AEGIS missions (generated projects) with optional status filtering',
    listMissionsSchema,
    async (args) => handleListMissions(args),
  );

  // ── Tool: Get mission details ──
  server.tool(
    'aegis_get_mission',
    'Get detailed information about a specific mission including its status, logs, and output file tree',
    {
      projectId: z.string().min(1).describe('The unique mission/project identifier'),
    },
    async (args) => handleGetMission(args),
  );

  // ── Tool: Delete mission ──
  server.tool(
    'aegis_delete_mission',
    'Delete a mission and all its associated files, logs, and search index entries (requires confirm: true)',
    {
      projectId: z.string().min(1).describe('The unique mission/project identifier'),
      confirm: z.boolean().describe('Must be set to true to confirm irreversible deletion'),
    },
    async (args) => handleDeleteMission(args),
  );

  // ── Tool: Search knowledge base ──
  server.tool(
    'aegis_search',
    'Semantically search across all indexed mission documents (code, logs, ideas) using vector similarity',
    searchSchema,
    async (args) => handleSearchKnowledge(args),
  );

  // ── Tool: Analyze design ──
  server.tool(
    'aegis_analyze_design',
    'Analyze a design description or screenshot URL and extract structured design tokens (colors, typography, style)',
    analyzeDesignSchema,
    async (args) => handleAnalyzeDesign(args),
  );

  // ── Tool: Get settings ──
  server.tool(
    'aegis_get_settings',
    'Get all AEGIS configuration settings (API keys are partially redacted for security)',
    {},
    async () => handleGetSettings({}),
  );

    // ── Tool: Update settings ──
  server.tool(
    'aegis_update_settings',
    'Update one or more AEGIS configuration settings (e.g., API keys, model selection)',
    updateSettingsSchema,
    async (args) => handleUpdateSettings(args),
  );

  // ── Tool: Create mission ──
  server.tool(
    'aegis_create_mission',
    'Create a new AEGIS mission — transforms a natural language idea into a complete, production-ready codebase. Returns the mission ID for status tracking.',
    createMissionSchema,
    async (args) => handleCreateMission(args),
  );

  return server;
}
