/**
 * AEGIS — Semantic Search Routes
 *
 * Provides vector similarity search across all indexed project documents.
 * Uses pgvector's cosine distance operator (<=>) for semantic matching.
 *
 * All searches are scoped to the requesting organization.
 */

import { Router, Request, Response } from 'express';
import prisma from '../db';
import { generateEmbedding } from '../services/embedding';
import { childLogger } from '../utils/logger';

const log = childLogger('search');
const router = Router();

// =============================================================================
// GET /api/search?q=<query>&limit=20&projectId=<optional>&source=<optional>
// =============================================================================

router.get('/', async (req: Request, res: Response) => {
  const orgId = req.organizationId;
  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  const query = (req.query.q as string || '').trim();
  const limit = Math.min(parseInt(req.query.limit as string || '20', 10) || 20, 50);
  const projectId = req.query.projectId as string | undefined;
  const source = req.query.source as string | undefined;
  const threshold = parseFloat(req.query.threshold as string || '0.0') || 0;

  if (!query) {
    res.status(400).json({ error: 'Query parameter "q" is required', code: 'VALIDATION_ERROR' });
    return;
  }

  log.info({ query, limit, projectId, source, orgId }, 'Semantic search');

  try {
    const queryVector = await generateEmbedding(query, orgId);

    const conditions: string[] = ['c.embedding IS NOT NULL'];
    const params: unknown[] = [];

    let paramIdx = 1;

    // Org-scoping
    conditions.push(`c.organization_id = $${paramIdx++}`);
    params.push(orgId);

    if (projectId) {
      conditions.push(`c.project_id = $${paramIdx++}`);
      params.push(projectId);
    }

    if (source) {
      conditions.push(`c.source = $${paramIdx++}`);
      params.push(source);
    }

    params.push(`[${queryVector.join(',')}]`);
    const queryVecParam = `$${paramIdx++}`;

    params.push(threshold);
    const thresholdParam = `$${paramIdx++}`;

    params.push(limit);
    const limitParam = `$${paramIdx++}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        c.id,
        c.project_id AS "projectId",
        c.source,
        c.file_path AS "filePath",
        c.content,
        c.created_at AS "createdAt",
        1 - (c.embedding <=> ${queryVecParam}::vector) AS "score"
      FROM document_chunks c
      ${whereClause}
        AND 1 - (c.embedding <=> ${queryVecParam}::vector) >= ${thresholdParam}
      ORDER BY c.embedding <=> ${queryVecParam}::vector ASC
      LIMIT ${limitParam}
    `;

    const results = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...params);

    res.json({
      query,
      count: results.length,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message, query }, 'Search failed');

    if (message.includes('operator does not exist') || message.includes('does not exist')) {
      res.status(503).json({
        error: 'Vector search unavailable. Ensure pgvector extension is enabled.',
        code: 'VECTOR_UNAVAILABLE',
        details: 'Run: CREATE EXTENSION IF NOT EXISTS vector; then re-index your data.',
      });
      return;
    }

    res.status(500).json({ error: 'Search failed', code: 'SEARCH_ERROR', message });
  }
});

// =============================================================================
// GET /api/search/stats — Show indexing stats (org-scoped)
// =============================================================================

router.get('/stats', async (req: Request, res: Response) => {
  const orgId = req.organizationId;

  if (!orgId) {
    res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    // Since document_chunks now has organization_id, we scope the stats
    const totalChunks = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM document_chunks WHERE organization_id = $1`,
      orgId,
    );
    const bySource = await prisma.$queryRawUnsafe<
      { source: string; count: bigint }[]
    >(
      `SELECT source, COUNT(*) as count FROM document_chunks WHERE organization_id = $1 GROUP BY source ORDER BY count DESC`,
      orgId,
    );
    const byProject = await prisma.$queryRawUnsafe<
      { projectId: string; count: bigint }[]
    >(
      `SELECT project_id AS "projectId", COUNT(*) as count FROM document_chunks WHERE organization_id = $1 GROUP BY project_id ORDER BY count DESC LIMIT 20`,
      orgId,
    );

    res.json({
      totalChunks: Number(totalChunks[0]?.count || 0),
      bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count) })),
      topProjects: byProject.map((r) => ({
        projectId: r.projectId,
        chunkCount: Number(r.count),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message, code: 'DB_ERROR' });
  }
});

export default router;
