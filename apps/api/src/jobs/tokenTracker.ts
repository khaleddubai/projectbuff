/**
 * AEGIS — Token Usage Tracker
 *
 * Tracks LLM token consumption per mission per agent.
 * Provides cost estimation based on model pricing data.
 * All data is persisted to the database for historical analysis.
 */

import prisma from '../db';
import { childLogger } from '../utils/logger';

const log = childLogger('token-tracker');

// =============================================================================
// Model Pricing (per 1M tokens, in USD)
// Updated from OpenRouter pricing as of May 2026.
// =============================================================================

interface ModelPricing {
  input: number;   // $ per 1M input tokens
  output: number;  // $ per 1M output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude
  'anthropic/claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic/claude-3-opus': { input: 15.00, output: 75.00 },
  'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 },
  'anthropic/claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },

  // Google Gemini
  'google/gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
  'google/gemini-2.0-pro': { input: 1.50, output: 2.00 },
  'google/gemini-2.5-pro-exp-03-25': { input: 1.50, output: 2.00 },

  // DeepSeek
  'deepseek/deepseek-v4-flash': { input: 0.50, output: 2.00 },
  'deepseek/deepseek-r1': { input: 0.55, output: 2.19 },

  // NVIDIA
  'nvidia/nemotron-4-340b-instruct': { input: 0.50, output: 1.50 },
  'nvidia/nvidia-nim': { input: 0.50, output: 1.50 },

  // Qwen
  'qwen/qwen3-coder-480b-a35b-instruct': { input: 0.50, output: 1.50 },
  'qwen/qwen-2.5-coder-32b-instruct': { input: 0.50, output: 1.50 },
  'qwen/qwen-max': { input: 1.60, output: 6.40 },
  'qwen/qwen-plus': { input: 0.80, output: 2.00 },

  // OpenAI
  'openai/gpt-4o': { input: 2.50, output: 10.00 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai/o3-mini': { input: 1.10, output: 4.40 },
  'openai/o1': { input: 15.00, output: 60.00 },
  'openai/text-embedding-3-small': { input: 0.02, output: 0.02 }, // flat rate
};

/** Default pricing for unknown models */
const DEFAULT_PRICING: ModelPricing = { input: 1.00, output: 3.00 };

/**
 * Get pricing for a given model, falling back to defaults.
 */
function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}

/**
 * Calculate estimated cost from token counts and model pricing.
 */
function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = getModelPricing(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places
}

// =============================================================================
// Token Usage Tracking
// =============================================================================

export interface TokenRecordInput {
  projectId: string;
  agent: string;
  model: string;
  provider?: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Record token usage for an LLM call within a mission.
 * Calculates and stores estimated cost automatically.
 */
export async function recordTokenUsage(input: TokenRecordInput): Promise<void> {
  const totalTokens = input.promptTokens + input.completionTokens;
  const estimatedCostUsd = calculateCost(
    input.model,
    input.promptTokens,
    input.completionTokens,
  );

  try {
    await prisma.tokenUsage.create({
      data: {
        projectId: input.projectId,
        agent: input.agent,
        model: input.model,
        provider: input.provider || 'openrouter',
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
    });

    log.debug(
      {
        projectId: input.projectId,
        agent: input.agent,
        totalTokens,
        costUsd: estimatedCostUsd,
      },
      'Token usage recorded',
    );
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err), projectId: input.projectId },
      'Failed to record token usage',
    );
    // Non-blocking — don't fail the mission if token tracking fails
  }
}

/**
 * Get token usage summary for a specific project/mission.
 */
export async function getMissionTokenUsage(projectId: string) {
  const records = await prisma.tokenUsage.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  if (records.length === 0) {
    return { totalTokens: 0, totalCostUsd: 0, byAgent: {}, records: [] };
  }

  const byAgent: Record<string, { tokens: number; cost: number; calls: number }> = {};

  for (const r of records) {
    if (!byAgent[r.agent]) {
      byAgent[r.agent] = { tokens: 0, cost: 0, calls: 0 };
    }
    byAgent[r.agent].tokens += r.totalTokens;
    byAgent[r.agent].cost += r.estimatedCostUsd || 0;
    byAgent[r.agent].calls += 1;
  }

  return {
    totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
    totalCostUsd: records.reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0),
    byAgent,
    records: records.map((r) => ({
      agent: r.agent,
      model: r.model,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      cost: r.estimatedCostUsd,
      createdAt: r.createdAt,
    })),
  };
}

/**
 * Get aggregate token usage across all missions for an organization.
 */
export async function getOrganizationTokenUsage(orgId: string) {
  const records = await prisma.tokenUsage.findMany({
    where: {
      project: { organizationId: orgId },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  if (records.length === 0) {
    return { totalTokens: 0, totalCostUsd: 0, totalMissions: 0, byModel: {} };
  }

  const byModel: Record<string, { tokens: number; cost: number; calls: number }> = {};
  const missionIds = new Set<string>();

  for (const r of records) {
    missionIds.add(r.projectId);
    if (!byModel[r.model]) {
      byModel[r.model] = { tokens: 0, cost: 0, calls: 0 };
    }
    byModel[r.model].tokens += r.totalTokens;
    byModel[r.model].cost += r.estimatedCostUsd || 0;
    byModel[r.model].calls += 1;
  }

  return {
    totalTokens: records.reduce((sum, r) => sum + r.totalTokens, 0),
    totalCostUsd: records.reduce((sum, r) => sum + (r.estimatedCostUsd || 0), 0),
    totalMissions: missionIds.size,
    byModel,
  };
}
