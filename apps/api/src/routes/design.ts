/**
 * AEGIS — Design Routes
 *
 * API endpoints for AI-powered design analysis and component generation.
 * Takes design descriptions or image URLs, extracts design tokens,
 * and generates matching React component code.
 *
 * All LLM config lookups are scoped to the requesting organization.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import prisma from '../db';
import { childLogger } from '../utils/logger';
import { getLLMConfig } from '../services/llmConfig';
import {
  DESIGN_ANALYSIS_SYSTEM,
  COMPONENT_GENERATOR_SYSTEM,
  buildDesignPrompt,
  buildComponentPrompt,
  tokensToCSSVariables,
  DEFAULT_TOKENS,
} from '../services/designParser';
import type { DesignTokens, DesignAnalysis } from '../services/designParser';

const log = childLogger('design-routes');
const router = Router();

// =============================================================================
// Schemas
// =============================================================================

const analyzeSchema = z.object({
  description: z.string().min(1, 'Design description is required'),
  imageUrl: z.string().url().optional(),
});

const generateSchema = z.object({
  componentName: z.string().min(1).max(100),
  specification: z.string().min(1).max(2000),
  tokens: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    backgroundColor: z.string(),
    surfaceColor: z.string(),
    textColor: z.string(),
    mutedTextColor: z.string(),
    borderColor: z.string(),
    errorColor: z.string(),
    successColor: z.string(),
    warningColor: z.string(),
    fontFamily: z.string(),
    headingFont: z.string(),
    baseFontSize: z.number(),
    borderRadius: z.number(),
    spacingUnit: z.number(),
    isDark: z.boolean(),
    style: z.string(),
    layout: z.string(),
  }),
});

// =============================================================================
// Helpers
// =============================================================================

/** Call the LLM with retry logic (handles rate limits, transient failures) */
async function callLLM(system: string, userPrompt: string, orgId: string, temp = 0.3, retries = 3): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const cfg = await getLLMConfig(orgId);
      if (!cfg.apiKey) throw new Error('No API key configured — check your LLM provider settings');

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
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || status === 502 || status === 503 || is429;
      if (isTransient && i < retries - 1) {
        const delay = is429 ? 30000 : 3000 * Math.pow(2, i);
        log.warn({ retry: i + 2, maxRetries: retries, delayMs: delay, err: lastErr?.message }, 'Retrying design LLM call');
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('All retries exhausted');
}

/** Parse JSON from an LLM response (strips code fences) */
function parseJSONResponse(text: string): Record<string, unknown> {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1]); } catch { /* fall through */ }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }

  throw new Error('Could not parse design analysis JSON from LLM response');
}

// =============================================================================
// Routes
// =============================================================================

/**
 * POST /api/design/analyze
 * Analyze a design description (and optional image URL) to extract design tokens.
 */
router.post('/analyze', async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const { description, imageUrl } = analyzeSchema.parse(req.body);
    log.info({ descriptionLen: description.length, hasImage: !!imageUrl }, 'Analyzing design');

    const prompt = buildDesignPrompt(description, imageUrl);
    const rawResponse = await callLLM(DESIGN_ANALYSIS_SYSTEM, prompt, orgId, 0.4);

    const parsed = parseJSONResponse(rawResponse) as unknown as DesignAnalysis;
    const analysis: DesignAnalysis = {
      tokens: parsed.tokens || DEFAULT_TOKENS,
      styleNotes: parsed.styleNotes || 'AI-generated design analysis.',
      componentSuggestions: parsed.componentSuggestions || ['HeroSection', 'FeatureCard', 'NavigationBar', 'Footer'],
    };

    log.info({ style: analysis.tokens.style }, 'Design analysis complete');
    res.json(analysis);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message }, 'Design analysis failed');
    res.status(500).json({
      error: 'Design analysis failed',
      details: message,
      fallback: {
        tokens: DEFAULT_TOKENS,
        styleNotes: 'Could not analyze design — using default tokens.',
        componentSuggestions: ['HeroSection', 'FeatureCard'],
      },
    });
  }
});

/**
 * POST /api/design/generate
 * Generate a React component from design tokens.
 */
router.post('/generate', async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const { componentName, specification, tokens } = generateSchema.parse(req.body);
    const cssVariables = tokensToCSSVariables(tokens as DesignTokens);
    const prompt = buildComponentPrompt(componentName, specification, tokens as DesignTokens, cssVariables);

    log.info({ componentName, specLen: specification.length }, 'Generating component');

    const rawResponse = await callLLM(COMPONENT_GENERATOR_SYSTEM, prompt, orgId, 0.3);

    log.info({ componentName, responseLen: rawResponse.length }, 'Component generated');
    res.json({ content: rawResponse, componentName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message }, 'Component generation failed');
    res.status(500).json({ error: 'Component generation failed', details: message });
  }
});

/**
 * GET /api/design/tokens
 * Return the default design tokens (for UI preview).
 */
router.get('/tokens', (_req: Request, res: Response) => {
  res.json({
    tokens: DEFAULT_TOKENS,
    cssVariables: tokensToCSSVariables(DEFAULT_TOKENS),
  });
});

export default router;
