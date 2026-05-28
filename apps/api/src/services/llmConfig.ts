/**
 * AEGIS — Multi-Provider LLM Configuration Resolver
 *
 * Shared utility for resolving LLM configuration across the entire codebase.
 * Supports multiple providers (NVIDIA, OpenRouter) with a unified interface.
 *
 * Provider selection is governed by the `LLM_PROVIDER` setting in the database:
 *   - "nvidia" — uses NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL
 *   - "openrouter" — uses OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL
 *
 * All lookups are scoped to the requesting organization's settings,
 * falling back to environment variables and then built-in defaults.
 */

import prisma from '../db';
import { decrypt } from './cryptoService';

// =============================================================================
// Types
// =============================================================================

export type LLMProvider = 'nvidia' | 'openrouter';

export interface LLMConfig {
  provider: LLMProvider;
  baseURL: string;
  apiKey: string;
  model: string;
}

// =============================================================================
// Defaults
// =============================================================================

const PROVIDER_DEFAULTS: Record<LLMProvider, { baseURL: string; model: string }> = {
  nvidia: {
    baseURL: 'https://integrate.api.nvidia.com/v1',
    model: 'qwen/qwen3-coder-480b-a35b-instruct',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    model: 'openrouter/free',
  },
};

const SETTING_KEYS: Record<LLMProvider, { apiKey: string; baseURL: string; model: string }> = {
  nvidia: {
    apiKey: 'NVIDIA_API_KEY',
    baseURL: 'NVIDIA_BASE_URL',
    model: 'NVIDIA_MODEL',
  },
  openrouter: {
    apiKey: 'OPENROUTER_API_KEY',
    baseURL: 'OPENROUTER_BASE_URL',
    model: 'OPENROUTER_MODEL',
  },
};

/** Env var names for each provider's settings */
const PROVIDER_ENV_KEYS: Record<LLMProvider, { apiKey: string; baseURL: string; model: string }> = {
  nvidia: {
    apiKey: 'NVIDIA_API_KEY',
    baseURL: 'NVIDIA_BASE_URL',
    model: 'NVIDIA_MODEL',
  },
  openrouter: {
    apiKey: 'OPENROUTER_API_KEY',
    baseURL: 'OPENROUTER_BASE_URL',
    model: 'OPENROUTER_MODEL',
  },
};

// =============================================================================
// Config Resolution
// =============================================================================

/**
 * Detect which LLM provider is configured for the given org.
 * Reads the `LLM_PROVIDER` setting, falling back to env var, then default "nvidia".
 */
export async function getProvider(orgId: string): Promise<LLMProvider> {
  const row = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: 'LLM_PROVIDER' } },
  });
  const value = row?.value || process.env.LLM_PROVIDER || 'openrouter';
  if (value !== 'nvidia' && value !== 'openrouter') return 'openrouter';
  return value;
}

/**
 * Resolve full LLM configuration for a given organization.
 *
 * 1. Detects the active provider (LLM_PROVIDER setting → env → "nvidia")
 * 2. Reads the provider-specific API key, base URL, and model from DB settings
 * 3. Falls back to environment variables
 * 4. Falls back to built-in defaults
 */
export async function getLLMConfig(orgId: string): Promise<LLMConfig> {
  const provider = await getProvider(orgId);
  const keys = SETTING_KEYS[provider];
  const envKeys = PROVIDER_ENV_KEYS[provider];
  const defaults = PROVIDER_DEFAULTS[provider];

  const [apiKeyRow, baseUrlRow, modelRow] = await Promise.all([
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: keys.apiKey } },
    }),
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: keys.baseURL } },
    }),
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: keys.model } },
    }),
  ]);

  return {
    provider,
    apiKey: apiKeyRow?.value ? decrypt(apiKeyRow.value) : (process.env[envKeys.apiKey] || ''),
    baseURL: baseUrlRow?.value || process.env[envKeys.baseURL] || defaults.baseURL,
    model: modelRow?.value || process.env[envKeys.model] || defaults.model,
  };
}

/**
 * Quick config lookup when you don't need the full LLM config
 * but need the base URL and API key for non-chat endpoints (e.g. embeddings).
 */
export async function getProviderBaseConfig(orgId: string): Promise<{
  provider: LLMProvider;
  baseURL: string;
  apiKey: string;
}> {
  const provider = await getProvider(orgId);
  const keys = SETTING_KEYS[provider];
  const envKeys = PROVIDER_ENV_KEYS[provider];
  const defaults = PROVIDER_DEFAULTS[provider];

  const [apiKeyRow, baseUrlRow] = await Promise.all([
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: keys.apiKey } },
    }),
    prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: keys.baseURL } },
    }),
  ]);

  return {
    provider,
    apiKey: apiKeyRow?.value ? decrypt(apiKeyRow.value) : (process.env[envKeys.apiKey] || ''),
    baseURL: baseUrlRow?.value || process.env[envKeys.baseURL] || defaults.baseURL,
  };
}
