/**
 * AEGIS — Multi-tenant Authentication Middleware
 *
 * Authenticates requests by looking up the API key in the database.
 * Each API key is associated with an Organization (tenant), and the
 * organization ID is attached to the request for downstream scoping.
 *
 * API keys are transmitted via:
 *   - `X-Api-Key` header
 *   - `Authorization: Bearer <key>` header
 *
 * Keys are stored as SHA-256 hashes — the raw key is shown only once on creation.
 *
 * For development, authentication can be bypassed by setting:
 *   AUTH_DISABLED=true
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../db';
import { childLogger } from '../utils/logger';
import { config } from '../config';

const log = childLogger('auth');

/** Sensitive settings keys that should never be exposed to clients in plaintext */
export const SENSITIVE_SETTINGS = new Set([
  'OPENROUTER_API_KEY',
  'NVIDIA_API_KEY',
  'OPENAI_API_KEY',
  'MASTER_API_KEY',
]);

/**
 * Hash an API key with SHA-256 for secure storage.
 * The raw key is never stored — only the hash is persisted.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf-8').digest('hex');
}

/**
 * Extract an API key string from the incoming request headers.
 * Returns undefined if no valid key header is found.
 */
function extractKeyFromRequest(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }
  return undefined;
}

/**
 * Resolve a default organization ID.
 * If no organizations exist yet, creates one and seeds an admin key.
 * This is called on first startup and as a fallback.
 */
export let defaultOrganizationId: string | undefined;

/**
 * Reset the cached default organization ID (useful in tests to force re-resolution).
 */
export function resetDefaultOrganization(): void {
  defaultOrganizationId = undefined;
}

export async function ensureDefaultOrganization(): Promise<string> {
  if (defaultOrganizationId) return defaultOrganizationId;

  // Check if any org exists
  const existing = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) {
    defaultOrganizationId = existing.id;
    return existing.id;
  }

  // Create default organization
  const org = await prisma.organization.create({
    data: { name: 'Default Organization' },
  });
  defaultOrganizationId = org.id;

  // Generate an admin API key
  const rawKey = `aegis_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);

  await prisma.apiKey.create({
    data: {
      keyPrefix,
      keyHash,
      name: 'admin',
      organizationId: org.id,
    },
  });

  log.warn(
    { orgId: org.id, keyPrefix },
    `🚀 Default organization created. Admin API key (shown once): ${rawKey}`,
  );

  // Seed default settings for the new org
  const nvidiaApiKey = process.env.NVIDIA_API_KEY || '';
  const nvidiaBaseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const nvidiaModel = process.env.NVIDIA_MODEL || 'qwen/qwen3-coder-480b-a35b-instruct';
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const openrouterModel = process.env.OPENROUTER_MODEL || 'openrouter/free';
  const openrouterBaseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const llmProvider = process.env.LLM_PROVIDER || 'openrouter';

  await prisma.setting.createMany({
    data: [
      { organizationId: org.id, key: 'LLM_PROVIDER', value: llmProvider },
      { organizationId: org.id, key: 'NVIDIA_API_KEY', value: nvidiaApiKey },
      { organizationId: org.id, key: 'NVIDIA_BASE_URL', value: nvidiaBaseUrl },
      { organizationId: org.id, key: 'NVIDIA_MODEL', value: nvidiaModel },
      { organizationId: org.id, key: 'OPENROUTER_API_KEY', value: openrouterApiKey },
      { organizationId: org.id, key: 'OPENROUTER_MODEL', value: openrouterModel },
      { organizationId: org.id, key: 'OPENROUTER_BASE_URL', value: openrouterBaseUrl },
    ],
  });

  return org.id;
}

/**
 * Authentication middleware.
 * Flow:
 *   1. Skip health/metrics — always public
 *   2. Skip if AUTH_DISABLED=true — attach default org for dev
 *   3. Extract API key from header
 *   4. Hash the key, look up in ApiKey table
 *   5. Attach organizationId to req
 *   6. Update lastUsedAt timestamp
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Health check and metrics are always public
    if (req.path === '/health' || req.path === '/metrics') {
      next();
      return;
    }

    // Dev mode — bypass auth, use default organization
    if (config.authDisabled) {
      req.organizationId = await ensureDefaultOrganization();
      next();
      return;
    }

    // Extract API key from request
    const providedKey = extractKeyFromRequest(req);

    if (!providedKey) {
      res.status(401).json({
        error: 'Missing API key. Provide via X-Api-Key header or Authorization: Bearer <key>',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    // Hash the key and look it up
    const keyHash = hashApiKey(providedKey);
    const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

    if (!apiKey) {
      res.status(403).json({
        error: 'Invalid API key',
        code: 'FORBIDDEN',
      });
      return;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      res.status(403).json({
        error: 'API key has expired',
        code: 'KEY_EXPIRED',
      });
      return;
    }

    // Attach org context and update last used
    req.organizationId = apiKey.organizationId;

    // Fire-and-forget last-used update
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {
        /* non-critical */
      });

    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message }, 'Auth middleware error');
    res.status(500).json({ error: 'Authentication service unavailable', code: 'AUTH_ERROR' });
  }
}

/**
 * Middleware to ensure a request has been authenticated with an organization.
 * Attach this to routes that MUST have an org context (all data routes).
 */
export function requireOrg(req: Request, _res: Response, next: NextFunction): void {
  if (!req.organizationId) {
    // If we reach here without org context, assign default as fallback
    ensureDefaultOrganization().then((orgId) => {
      req.organizationId = orgId;
      next();
    });
    return;
  }
  next();
}

/**
 * Redact sensitive settings values for client-safe responses.
 * Shows first 8 chars + '...' + last 4 chars.
 */
export function redactSensitiveSettings(
  settings: Record<string, string>,
): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (SENSITIVE_SETTINGS.has(key) && value && value.length > 12) {
      redacted[key] = value.slice(0, 8) + '...' + value.slice(-4);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
