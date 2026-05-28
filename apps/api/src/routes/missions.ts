import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import prisma from '../db';
import { aegisEvents, getMissionOutputDir } from '../orchestrator';
import { missionQueue, getQueueMetrics } from '../jobs/queue';
import { getMissionTokenUsage, getOrganizationTokenUsage } from '../jobs/tokenTracker';
import { validateBody, missionRequestSchema } from '../middleware/validation';
import { readDirectoryTree } from '../services/fileService';

const router = Router();

// Create new mission
router.post('/', validateBody(missionRequestSchema), async (req: Request, res: Response) => {
  const { idea } = req.body;
  const orgId = req.organizationId;
  const id = uuidv4();

  await prisma.project.create({
    data: { id, name: 'pending', idea, status: 'running', organizationId: orgId },
  });

  // Submit to BullMQ queue instead of direct call
  await missionQueue.add('mission:execute', {
    projectId: id,
    idea,
    orgId,
    submittedAt: new Date().toISOString(),
  });

  res.json({ id, status: 'running', queued: true });
});

// List all missions (scoped to org)
router.get('/', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  const projects = await prisma.project.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
  });

  res.json(projects);
});

// Get mission status and logs
router.get('/:id', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  const project = await prisma.project.findFirst({
    where: { id: req.params.id, organizationId: orgId },
  });

  if (!project) {
    res.status(404).json({ error: 'Mission not found', code: 'NOT_FOUND' });
    return;
  }

  const logs = await prisma.projectLog.findMany({
    where: { projectId: req.params.id },
    orderBy: { createdAt: 'asc' },
  });

  res.json({ project, logs });
});

// SSE stream for real-time mission logs
router.get('/:id/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Send initial connected event
  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  const onUpdate = (data: { projectId: string }) => {
    if (data.projectId === req.params.id) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };

  aegisEvents.on('update', onUpdate);

  // Heartbeat to prevent connection timeout
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    aegisEvents.removeListener('update', onUpdate);
    clearInterval(heartbeat);
  });
});

// Download mission ZIP artifact
router.get('/:id/download', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  const project = await prisma.project.findFirst({
    where: { id: req.params.id, organizationId: orgId },
    select: { outputPath: true },
  });

  if (!project?.outputPath || !fs.existsSync(project.outputPath)) {
    res.status(400).json({ error: 'Build not ready or ZIP missing', code: 'NOT_READY' });
    return;
  }

  res.download(project.outputPath, path.basename(project.outputPath));
});

// Get mission file tree
router.get('/:id/files', (req: Request, res: Response) => {
  const outDir = getMissionOutputDir(req.params.id);

  if (!fs.existsSync(outDir)) {
    res.json({ tree: [] });
    return;
  }

  res.json({ tree: readDirectoryTree(outDir) });
});

// Get file content from mission output
router.get('/:id/content', (req: Request, res: Response) => {
  const filePath = req.query.path as string;

  if (!filePath) {
    res.status(400).json({ error: 'Missing path parameter', code: 'VALIDATION_ERROR' });
    return;
  }

  const outDir = getMissionOutputDir(req.params.id);
  const target = path.join(outDir, filePath);

  // Prevent directory traversal
  if (!target.startsWith(outDir)) {
    res.status(400).json({ error: 'Invalid path', code: 'INVALID_PATH' });
    return;
  }

  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.status(404).json({ error: 'File not found', code: 'NOT_FOUND' });
    return;
  }

  // Limit file size to 1MB
  if (fs.statSync(target).size > 1024 * 1024) {
    res.status(400).json({ error: 'File too large', code: 'FILE_TOO_LARGE' });
    return;
  }

  res.json({ content: fs.readFileSync(target, 'utf-8'), path: filePath });
});

// Get security audit status
router.get('/:id/security', (req: Request, res: Response) => {
  const outDir = getMissionOutputDir(req.params.id);
  const auditPath = path.join(outDir, 'SECURITY_AUDIT.md');

  if (!fs.existsSync(auditPath)) {
    res.json({ clean: true, findings: [] });
    return;
  }

  const content = fs.readFileSync(auditPath, 'utf-8');
  const findings = content
    .split('\n')
    .filter((l: string) => l.trim().length > 0 && !l.startsWith('#'));

  res.json({ clean: findings.length === 0, findings });
});

// =============================================================================
// Job Queue Monitoring Endpoints
// =============================================================================

// Get queue metrics (active, waiting, completed, failed counts)
router.get('/queue/metrics', async (_req: Request, res: Response) => {
  const metrics = await getQueueMetrics();
  res.json(metrics);
});

// Cancel a queued/running job
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;

  // Find the job in the queue by the projectId in its data
  const jobs = await missionQueue.getJobs(['active', 'waiting', 'delayed']);
  const job = jobs.find((j) => j.data.projectId === id);

  if (!job) {
    res.status(404).json({ error: 'No active job found for this mission', code: 'NOT_FOUND' });
    return;
  }

  await job.remove();

  // Update project status
  await prisma.project.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  res.json({ id, status: 'cancelled' });
});

// =============================================================================
// Token Usage Endpoints
// =============================================================================

// Get token usage for a specific mission
router.get('/:id/tokens', async (req: Request, res: Response) => {
  const usage = await getMissionTokenUsage(req.params.id);
  res.json(usage);
});

// Get token usage for the entire organization
router.get('/tokens/summary', async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  const usage = await getOrganizationTokenUsage(orgId);
  res.json(usage);
});

export default router;
