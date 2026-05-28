/**
 * AEGIS — Dashboard Stats Endpoint
 *
 * Aggregates mission + search data for the dashboard overview.
 * All data is scoped to the requesting organization.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  // Run all aggregations in parallel
  const [counts, total, recentMissions] = await Promise.all([
    // Counts by status
    prisma.$queryRawUnsafe<{ status: string; count: bigint }[]>(
      `SELECT status, COUNT(*) as count FROM "projects" WHERE "organization_id" = $1 GROUP BY status`,
      orgId,
    ),

    // Total count
    prisma.project.count({ where: { organizationId: orgId } }),

    // Recent 5 missions with log count
    prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        idea: true,
        status: true,
        createdAt: true,
        _count: { select: { logs: true } },
      },
    }),
  ]);

  // Build status map
  const statusMap: Record<string, number> = { running: 0, completed: 0, failed: 0, pending: 0 };
  for (const row of counts) {
    statusMap[row.status] = Number(row.count);
  }

  const completed = statusMap.completed || 0;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    total,
    running: statusMap.running || 0,
    completed,
    failed: statusMap.failed || 0,
    pending: statusMap.pending || 0,
    successRate,
    recentMissions: recentMissions.map((m) => ({
      id: m.id,
      idea: m.idea.slice(0, 120),
      status: m.status,
      createdAt: m.createdAt,
      logCount: m._count.logs,
    })),
  });
});

export default router;
