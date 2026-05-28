/**
 * AEGIS — Mission Orchestrator
 *
 * Core orchestration engine that executes a full mission lifecycle:
 *   1. Conductor → plan generation (LLM)
 *   2. Agent dispatch → phases executed by specialized agents
 *   3. Auto-fix loop → build failures trigger automatic fixes
 *   4. Security scan → static analysis for secrets/dangerous patterns
 *   5. Packaging → ZIP + index for semantic search
 *
 * Now supports callback hooks for:
 *  - Progress reporting (used by BullMQ workers)
 *  - Token usage tracking (persisted to database)
 */

import { OpenAI } from 'openai';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { childLogger } from './utils/logger';
import prisma from './db';
import { getLLMConfig } from './services/llmConfig';
import { parseAndWriteFiles, parseBattlePlan } from './utils/fileWriter';
import { zipDirectory } from './utils/zipper';
import { indexProject } from './services/indexer';
import { checkBuild, formatBuildErrors, installDependencies } from './services/buildService';

const log = childLogger('orchestrator');
import {
  CONDUCTOR_PROMPT, ARCHITECT_PROMPT, BACKEND_PROMPT,
  FRONTEND_PROMPT, DEVOPS_PROMPT, QA_PROMPT, TECH_WRITER_PROMPT, FIXER_PROMPT,
} from './agents/prompts';

export const aegisEvents = new EventEmitter();
import { PROJECT_ROOT, getMissionOutputDir } from './utils/paths';
export { getMissionOutputDir };
log.info({ projectRoot: PROJECT_ROOT }, 'Project root resolved');

// =============================================================================
// Types
// =============================================================================

/** Token usage data reported by the orchestrator */
export interface TokenUsageSnapshot {
  projectId: string;
  agent: string;
  model: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
}

/** Callback hooks for integration with job workers */
export interface MissionHooks {
  /** Report progress (0-100) */
  onProgress?: (progress: number) => void | Promise<void>;
  /** Record token usage from an LLM call */
  onTokenUsage?: (usage: TokenUsageSnapshot) => void | Promise<void>;
}

/** Result returned by runMission */
export interface MissionResult {
  status: 'completed' | 'failed';
  outputPath?: string;
  agentCount: number;
  totalTokens?: number;
}

// =============================================================================
// LLM Configuration & Calling
// =============================================================================

/**
 * Call the LLM with retry logic, returning the response text and
 * reporting token usage via the hooks system.
 */
async function chatWithRetry(
  system: string,
  user: string,
  orgId: string,
  opts: {
    temp?: number;
    retries?: number;
    agent?: string;
    projectId?: string;
    hooks?: MissionHooks;
  } = {},
): Promise<string> {
  const { temp = 0.2, retries = 3, agent, projectId, hooks } = opts;
  let lastErr: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      const cfg = await getLLMConfig(orgId);
      log.info({ provider: cfg.provider, model: cfg.model, baseURL: cfg.baseURL, keyLen: cfg.apiKey.length, orgId }, 'LLM config resolved');
      if (!cfg.apiKey) throw new Error('No API key configured');

      const openai = new OpenAI({
        baseURL: cfg.baseURL,
        apiKey: cfg.apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AEGIS',
        },
      });

      const resp = await openai.chat.completions.create({
        model: cfg.model,
        temperature: temp,
        max_tokens: 16000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const text = resp.choices[0]?.message?.content || '';
      if (!text || text.trim().length < 10) throw new Error('Empty response');

      // Track token usage if hooks are provided
      if (hooks?.onTokenUsage && projectId && agent) {
        const usage = resp.usage;
        if (usage) {
          hooks.onTokenUsage({
            projectId,
            agent,
            model: cfg.model,
            provider: cfg.provider,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
          });
        }
      }

      return text;
    } catch (err: unknown) {
      lastErr = err;
      const apiError = err as { message?: string; status?: number; response?: { status?: number }; code?: string };
      const msg = apiError.message || '';
      const status = apiError.status || apiError.response?.status || 0;
      const is429 = status === 429 || msg.includes('429');
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || status === 502 || status === 503 || is429;

      if (isTransient && i < retries - 1) {
        const delay = is429 ? 30000 : 3000 * Math.pow(2, i);
        log.warn(
          { retry: i + 2, maxRetries: retries, delayMs: delay, err: lastErr?.message },
          'Retrying LLM call',
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('All retries exhausted');
}

// =============================================================================
// Event Logging
// =============================================================================

async function logEvent(projectId: string, agent: string, message: string, type: 'info' | 'file' | 'error' = 'info') {
  await prisma.projectLog.create({
    data: { projectId, agent, message, type },
  });
  aegisEvents.emit('update', { projectId, agent, message, type, timestamp: new Date().toISOString() });
}

function fixPrismaSchema(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let counter = 1;
  const original = content;
  content = content.replace(/@relation\(\)/g, () => `@relation("Relation${counter++}")`);
  if (counter > 1) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

// =============================================================================
// Main Mission Execution
// =============================================================================

/**
 * Execute a full mission lifecycle.
 *
 * @param projectId - UUID of the project/mission
 * @param idea - The user's idea/description
 * @param orgId - Organization ID for scoped settings (optional, resolves from project if not provided)
 * @param hooks - Optional callbacks for progress reporting and token tracking
 */
export async function runMission(
  projectId: string,
  idea: string,
  orgId?: string,
  hooks?: MissionHooks,
): Promise<MissionResult> {
  let resolvedOrgId = orgId;
  let totalTokens = 0;
  let agentCount = 0;

  // If no orgId provided, resolve from the project record
  if (!resolvedOrgId) {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      resolvedOrgId = project?.organizationId;
    } catch {
      // Proceed with env-var fallback
    }
  }

  const effectiveOrgId = resolvedOrgId || 'none';

  try {
    const outDir = getMissionOutputDir(projectId);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    log.info({ projectId, outDir }, 'Starting mission');
    await hooks?.onProgress?.(10);

    // =========================================================================
    // PHASE 0: Conductor — Generate Battle Plan
    // =========================================================================
    logEvent(projectId, 'conductor', 'Analyzing mission...', 'info');
    let planRaw = await chatWithRetry(
      CONDUCTOR_PROMPT,
      'Director Idea: ' + idea + '\n\nReturn ONLY JSON in a code block.',
      effectiveOrgId,
      { agent: 'conductor', projectId, hooks },
    );

    let plan = parseBattlePlan(planRaw);
    if (!plan) {
      logEvent(projectId, 'conductor', 'Parse failed, retrying...', 'error');
      planRaw = await chatWithRetry(
        CONDUCTOR_PROMPT,
        'CRITICAL: Return ONLY valid JSON. Idea: ' + idea,
        effectiveOrgId,
        { agent: 'conductor', projectId, hooks, temp: 0.1 },
      );
      plan = parseBattlePlan(planRaw);
    }
    if (!plan) throw new Error('Failed to parse battle plan');

    const projectName = (plan.projectName as string) || 'untitled-project';
    await prisma.project.update({ where: { id: projectId }, data: { name: projectName } });

    const stack = (plan.stack as Record<string, string>) || {
      frontend: 'nextjs',
      backend: 'express',
      database: 'sqlite',
    };

    const phases = ((plan.phases as Array<Record<string, unknown>>) || []);
    logEvent(
      projectId,
      'conductor',
      `Battle plan: "${projectName}" — Stack: ${stack.frontend}+${stack.backend} — ${phases.length} phases`,
      'info',
    );
    await hooks?.onProgress?.(20);

    // =========================================================================
    // PHASES 1-N: Agent Dispatch
    // =========================================================================
    const phaseProgressStart = 20;
    const phaseProgressRange = 40;
    let phaseIndex = 0;

    for (const phase of phases) {
      phaseIndex++;
      const agentKey: string = phase.agent || '';
      const system = getSystemPrompt(agentKey);
      if (!system) continue;

      agentCount++;

      logEvent(projectId, agentKey, `Starting ${phase.phase}...`, 'info');

      const stackContext =
        `\n\nSTACK INFO: Frontend=${stack.frontend}, Backend=${stack.backend}, ` +
        `Database=${stack.database}, Styling=${stack.styling || 'tailwind'}`;

      let response: string;
      try {
        response = await chatWithRetry(
          system,
          `Phase: ${phase.phase}\nDeliverables: ${((phase.deliverables as string[]) || []).join(', ')}${stackContext}`,
          effectiveOrgId,
          { agent: agentKey, projectId, hooks },
        );
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        logEvent(projectId, agentKey, 'Failed: ' + errMsg, 'error');
        continue;
      }

      let written = parseAndWriteFiles(response, outDir);

      // Retry if zero files produced
      let retryCount = 0;
      while (written.length === 0 && retryCount < 2) {
        retryCount++;
        logEvent(projectId, agentKey, `Zero files. Retry ${retryCount}/2...`, 'error');
        try {
          response = await chatWithRetry(
            system,
            'CRITICAL: Output at least one <FILE> block. No prose.\n' + stackContext,
            effectiveOrgId,
            { agent: agentKey, projectId, hooks, temp: 0.3 },
          );
          written = parseAndWriteFiles(response, outDir);
        } catch {
          break;
        }
      }

      for (const file of written) {
        if (file.includes('schema.prisma')) fixPrismaSchema(path.join(outDir, file));
      }

      if (written.length > 0) {
        logEvent(projectId, agentKey, `Delivered ${written.length} files: ${written.join(', ')}`, 'file');
      } else {
        logEvent(projectId, agentKey, 'No artifacts.', 'info');
      }

      // Report progress
      const progress = phaseProgressStart + Math.round((phaseIndex / phases.length) * phaseProgressRange);
      await hooks?.onProgress?.(progress);
    }

    // =========================================================================
    // Auto-Fix Loop
    // =========================================================================
    const MAX_FIX_ATTEMPTS = 3;
    let fixAttempt = 0;
    let buildOk = false;

    await hooks?.onProgress?.(60);

    while (fixAttempt < MAX_FIX_ATTEMPTS && !buildOk) {
      const buildResult = checkBuild(outDir);

      if (buildResult.success) {
        buildOk = true;
        logEvent(projectId, 'fixer', 'Build check passed', 'info');
        break;
      }

      fixAttempt++;
      const errorFiles = [...new Set(buildResult.errors.map((e) => e.file).filter(Boolean))];

      logEvent(
        projectId,
        'fixer',
        `Build failed (${buildResult.errors.length} errors, attempt ${fixAttempt}/${MAX_FIX_ATTEMPTS})`,
        'info',
      );

      const fileContents: string[] = [];
      const MAX_FILE_CHARS = 3000;
      for (const file of errorFiles) {
        const filePath = path.join(outDir, file);
        if (fs.existsSync(filePath)) {
          try {
            let content = fs.readFileSync(filePath, 'utf-8');
            if (content.length > MAX_FILE_CHARS) {
              content =
                content.slice(0, MAX_FILE_CHARS) +
                `\n... (truncated, ${content.length - MAX_FILE_CHARS} more chars)`;
            }
            fileContents.push(`=== ${file} ===\n${content}\n=== END ${file} ===`);
          } catch {
            fileContents.push(`=== ${file} ===\n(could not read)\n=== END ${file} ===`);
          }
        } else {
          fileContents.push(`=== ${file} ===\n(file not found — may need to be created)\n=== END ${file} ===`);
        }
      }

      const errorSummary = formatBuildErrors(buildResult);
      installDependencies(outDir);

      try {
        const fixPrompt = [
          'Build errors detected. Fix the following errors:\n',
          errorSummary,
          '\n---\nCurrent file contents:\n',
          fileContents.join('\n\n'),
          '\n\nOutput the corrected files using <FILE path="..."> format.',
        ].join('');

        const fixResponse = await chatWithRetry(
          FIXER_PROMPT,
          fixPrompt,
          effectiveOrgId,
          { agent: 'fixer', projectId, hooks, temp: 0.1, retries: 2 },
        );
        const written = parseAndWriteFiles(fixResponse, outDir);

        if (written.length > 0) {
          agentCount++;
          logEvent(projectId, 'fixer', `Applied ${written.length} fix(es): ${written.join(', ')}`, 'file');
        } else {
          logEvent(projectId, 'fixer', 'Fixer returned no files', 'error');
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logEvent(projectId, 'fixer', 'Fix attempt failed: ' + errMsg, 'error');
      }
    }

    if (!buildOk) {
      logEvent(
        projectId,
        'fixer',
        `Build still failing after ${MAX_FIX_ATTEMPTS} attempts — continuing with artifacts`,
        'error',
      );
    }

    await hooks?.onProgress?.(75);

    // =========================================================================
    // Security Scan
    // =========================================================================
    logEvent(projectId, 'securityEngineer', 'Running security audit...', 'info');
    const findings: string[] = [];
    try {
      const walkDir = (dir: string) => {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            if (!['node_modules', '.git', '.next', 'dist'].includes(item)) walkDir(full);
          } else {
            const ext = path.extname(item).toLowerCase();
            if (['.png', '.jpg', '.ico'].includes(ext)) continue;
            try {
              const c = fs.readFileSync(full, 'utf-8');
              if (/password\s*[=:]\s*["'][^"']{3,}["']/i.test(c)) findings.push(`[SECRET] password in ${item}`);
              if (/api[_-]?key\s*[=:]\s*["'][^"']{8,}["']/i.test(c)) findings.push(`[SECRET] API key in ${item}`);
              if (/eval\s*\(/i.test(c)) findings.push(`[DANGER] eval() in ${item}`);
            } catch {
              // skip unreadable
            }
          }
        }
      };
      walkDir(outDir);
    } catch {
      // skip if dir can't be walked
    }

    if (findings.length > 0) {
      fs.writeFileSync(path.join(outDir, 'SECURITY_AUDIT.md'), '# Security Audit\n\n' + findings.join('\n'), 'utf-8');
      logEvent(projectId, 'securityEngineer', `Found ${findings.length} issues.`, 'error');
    } else {
      logEvent(projectId, 'securityEngineer', 'Scan clean.', 'info');
    }

    await hooks?.onProgress?.(85);

    // =========================================================================
    // Package & Finalize
    // =========================================================================
    const zipPath = path.join(PROJECT_ROOT, 'output', projectName + '.zip');
    await zipDirectory(outDir, zipPath);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'completed', outputPath: zipPath },
    });
    await logEvent(projectId, 'conductor', 'Mission complete!', 'info');

    await hooks?.onProgress?.(95);

    // Index project for semantic search (non-blocking)
    indexProject(projectId).catch((err: Error) =>
      log.warn({ err: err.message, projectId }, 'Indexing failed'),
    );

    await hooks?.onProgress?.(100);

    log.info({ projectId, agentCount }, 'Mission completed successfully');
    return { status: 'completed', outputPath: zipPath, agentCount, totalTokens };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await logEvent(projectId, 'system', 'Critical failure: ' + errMsg, 'error');
    await prisma.project.update({ where: { id: projectId }, data: { status: 'failed' } });
    log.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err, projectId },
      'Mission failed',
    );
    return { status: 'failed', agentCount, totalTokens };
  }
}

// =============================================================================
// Helpers
// =============================================================================

function getSystemPrompt(agentKey: string): string {
  switch (agentKey) {
    case 'architect': return ARCHITECT_PROMPT;
    case 'backendEngineer': return BACKEND_PROMPT;
    case 'frontendEngineer': return FRONTEND_PROMPT;
    case 'devOps': return DEVOPS_PROMPT;
    case 'qaEngineer': return QA_PROMPT;
    case 'techWriter': return TECH_WRITER_PROMPT;
    default: return '';
  }
}
