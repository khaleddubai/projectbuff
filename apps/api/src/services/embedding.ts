/**
 * AEGIS — Embedding Service
 *
 * Generates vector embeddings using OpenAI-compatible embedding APIs.
 * Uses text-embedding-3-small by default (1536 dimensions, supports
 * dimension reduction via `dimensions` parameter).
 *
 * All config lookups are scoped to the provided organization ID.
 * If no orgId is provided, falls back to environment variables.
 */

import { OpenAI } from 'openai';
import prisma from '../db';
import { getProviderBaseConfig } from './llmConfig';
import { childLogger } from '../utils/logger';

/** Max characters per embedding input (text-embedding-3-small supports ~8191 tokens ≈ 32K chars) */
const MAX_CHARS_PER_INPUT = 32000;

const log = childLogger('embedding');

export interface EmbeddingConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  dimensions: number;
}

/**
 * Resolve the embedding model config from database settings or env vars.
 * The orgId parameter scopes the lookup to a specific organization.
 * If orgId is not provided, falls back to env vars.
 */
export async function getEmbeddingConfig(orgId?: string): Promise<EmbeddingConfig> {
  if (!orgId) {
    return {
      baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_API_KEY || '',
      model: process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small',
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
    };
  }

  // Use the active LLM provider's base config for API key + base URL,
  // but allow a separate EMBEDDING_MODEL setting
  const providerConfig = await getProviderBaseConfig(orgId);

  const [modelRow] = await Promise.all([
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: 'EMBEDDING_MODEL' } },
    }),
  ]);

  return {
    baseURL: providerConfig.baseURL,
    apiKey: providerConfig.apiKey,
    model: modelRow?.value || process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
  };
}

/**
 * Generate an embedding vector for a single text string.
 * Returns a Float32Array or number[] of the specified dimensions.
 */
export async function generateEmbedding(text: string, orgId?: string): Promise<number[]> {
  const cfg = await getEmbeddingConfig(orgId);

  if (!cfg.apiKey) {
    log.warn('No API key configured for embeddings — returning zero vector');
    return new Array(cfg.dimensions).fill(0);
  }

  // Truncate very long texts to avoid token limits
  const truncated = text.length > MAX_CHARS_PER_INPUT ? text.slice(0, MAX_CHARS_PER_INPUT) : text;

  try {
    const openai = new OpenAI({
      baseURL: cfg.baseURL,
      apiKey: cfg.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AEGIS',
      },
    });

    const resp = await openai.embeddings.create({
      model: cfg.model,
      input: truncated,
      dimensions: cfg.dimensions,
    });

    return resp.data[0]?.embedding || new Array(cfg.dimensions).fill(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message }, 'Embedding generation failed');
    // Return zero vector on failure (graceful degradation)
    return new Array(cfg.dimensions).fill(0);
  }
}

/**
 * Generate embeddings for multiple texts in batches.
 * Returns an array of embedding vectors in the same order as inputs.
 */
export async function generateEmbeddings(texts: string[], orgId?: string): Promise<number[][]> {
  if (texts.length === 0) return [];

  const cfg = await getEmbeddingConfig(orgId);
  const openai = new OpenAI({
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AEGIS',
    },
  });

  const results: number[][] = [];
  const BATCH_SIZE = 20;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) =>
      t.length > MAX_CHARS_PER_INPUT ? t.slice(0, MAX_CHARS_PER_INPUT) : t,
    );

    try {
      const resp = await openai.embeddings.create({
        model: cfg.model,
        input: batch,
        dimensions: cfg.dimensions,
      });

      const sorted = resp.data.sort((a, b) => a.index - b.index);
      results.push(...sorted.map((d) => d.embedding));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log.error({ err: message, batch: i }, 'Batch embedding failed');
      for (let j = 0; j < batch.length; j++) {
        results.push(new Array(cfg.dimensions).fill(0));
      }
    }

    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}
