import { Router, Request, Response } from 'express';
import prisma from '../db';
import { validateBody, settingsBulkSchema } from '../middleware/validation';
import { redactSensitiveSettings, SENSITIVE_SETTINGS } from '../middleware/auth';
import { encrypt, decrypt } from '../services/cryptoService';

const router = Router();

// Get all settings for the authenticated org (with sensitive values redacted)
router.get('/', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  const rows = await prisma.setting.findMany({
    where: { organizationId: orgId },
    select: { key: true, value: true },
  });

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = decrypt(row.value);
  }

  // Redact sensitive values for client response
  res.json(redactSensitiveSettings(settings));
});

// Update settings in bulk — org-scoped
router.post('/bulk', validateBody(settingsBulkSchema), async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const body = req.body as Record<string, string>;

    await prisma.$transaction(
      Object.entries(body).map(([key, value]) => {
        const storedValue = SENSITIVE_SETTINGS.has(key) && value ? encrypt(value) : value;
        return prisma.setting.upsert({
          where: { organizationId_key: { organizationId: orgId, key } },
          update: { value: storedValue },
          create: { organizationId: orgId, key, value: storedValue },
        });
      }),
    );

    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'DB_ERROR' });
  }
});

export default router;
