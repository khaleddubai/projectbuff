/**
 * AEGIS — API Key Management Routes
 *
 * These routes allow organization administrators to manage API keys
 * associated with their organization. Each key is scoped to the
 * organization extracted from the authenticated request.
 *
 * Endpoints:
 *   GET    /api/auth/keys       — List all keys (prefix, name, last used, expires)
 *   POST   /api/auth/keys       — Create a new API key (full key shown once)
 *   DELETE /api/auth/keys/:id   — Revoke (delete) an API key
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db';
import { hashApiKey } from '../middleware/auth';
import { childLogger } from '../utils/logger';

const log = childLogger('auth-routes');
const router = Router();

// =============================================================================
// GET /api/auth/keys — List all API keys for the authenticated org
// =============================================================================

router.get('/keys', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ keys, count: keys.length });
});

// =============================================================================
// POST /api/auth/keys — Create a new API key
// =============================================================================

router.post('/keys', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  const name = (req.body.name as string || 'default').trim().slice(0, 100) || 'default';

  // Generate a secure random key
  const rawKey = `aegis_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 8);

  let expiresAt: Date | undefined;
  if (req.body.expiresInDays) {
    const days = parseInt(req.body.expiresInDays, 10);
    if (days > 0 && days <= 365) {
      expiresAt = new Date(Date.now() + days * 86400000);
    }
  }

  const apiKey = await prisma.apiKey.create({
    data: {
      keyPrefix,
      keyHash,
      name,
      organizationId: orgId,
      expiresAt,
    },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  log.info({ keyPrefix, name }, 'New API key created');

  // The raw key is only returned once — it can never be retrieved again
  res.status(201).json({
    ...apiKey,
    rawKey, // ⚠️ This is the only time the full key is shown
    warning: 'Save this key now — it will not be shown again.',
  });
});

// =============================================================================
// DELETE /api/auth/keys/:id — Revoke (delete) an API key
// =============================================================================

router.delete('/keys/:id', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  // Verify the key belongs to this org
  const existing = await prisma.apiKey.findFirst({
    where: { id: req.params.id, organizationId: orgId },
  });

  if (!existing) {
    res.status(404).json({ error: 'API key not found', code: 'NOT_FOUND' });
    return;
  }

  await prisma.apiKey.delete({ where: { id: req.params.id } });

  log.info({ keyPrefix: existing.keyPrefix }, 'API key revoked');

  res.json({ success: true, deleted: req.params.id });
});

export default router;
