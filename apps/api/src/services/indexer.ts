/**
 * AEGIS — Indexing Service
 *
 * Chunks project content (ideas, logs, output files) into segments,
 * generates embeddings, and stores them in the document_chunks table
 * via raw SQL for pgvector compatibility.
 *
 * All chunks are scoped to the project's organization.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../db';
import { generateEmbeddings } from './embedding';
import { childLogger } from '../utils/logger';
import { getMissionOutputDir } from '../utils/paths';

const log = childLogger('indexer');

const EXCLUDED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.gz']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', 'dist']);

/**
 * Chunk a long text into overlapping segments.
 * Each chunk is roughly `chunkSize` characters with `overlap` overlap.
 */
function chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);

    let breakPoint = end;
    if (end < text.length) {
      const fragment = text.slice(end - 100, end + 100);
      const newlineIdx = fragment.indexOf('\n');
      if (newlineIdx >= 0 && newlineIdx < 150) {
        breakPoint = end - 100 + newlineIdx + 1;
      } else {
        const sentenceIdx = fragment.indexOf('. ');
        if (sentenceIdx >= 0 && sentenceIdx < 150) {
          breakPoint = end - 100 + sentenceIdx + 2;
        }
      }
    }

    chunks.push(text.slice(start, breakPoint));
    start = breakPoint - overlap;
  }

  return chunks;
}

/**
 * Index a project's core metadata (idea + name) as a document chunk.
 */
export async function indexProjectIdea(projectId: string, orgId?: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, idea: true, organizationId: true },
  });

  if (!project) {
    log.warn({ projectId }, 'Project not found for indexing');
    return;
  }

  const resolvedOrgId = orgId || project.organizationId;
  if (!resolvedOrgId) {
    log.warn({ projectId }, 'No organization ID found for project — skipping index');
    return;
  }

  const text = `Project: ${project.name}\nDescription: ${project.idea}`;
  if (!text.trim()) return;

  const existing = await prisma.documentChunk.findFirst({
    where: { projectId, source: 'idea' },
  });
  if (existing) return;

  const chunkTexts = chunkText(text);
  const embeddings = await generateEmbeddings(chunkTexts, resolvedOrgId);

  for (let i = 0; i < chunkTexts.length; i++) {
    await storeChunk(projectId, resolvedOrgId, 'idea', null, chunkTexts[i], embeddings[i]);
  }

  log.info({ projectId, chunks: chunkTexts.length }, 'Project idea indexed');
}

/**
 * Index a project's output files (code, configs, docs) as document chunks.
 */
export async function indexProjectOutput(projectId: string, orgId?: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  const resolvedOrgId = orgId || project?.organizationId;
  if (!resolvedOrgId) {
    log.warn({ projectId }, 'No organization ID — skipping output index');
    return;
  }

  const outDir = getMissionOutputDir(projectId);

  if (!fs.existsSync(outDir)) {
    log.warn({ projectId }, 'Output directory not found for indexing');
    return;
  }

  const files: { path: string; content: string }[] = [];
  walkDir(outDir, outDir, files);

  if (files.length === 0) {
    log.info({ projectId }, 'No files to index');
    return;
  }

  log.info({ projectId, fileCount: files.length }, 'Indexing output files');

  const allChunks: { sourcePath: string; text: string }[] = [];

  for (const file of files) {
    const relPath = path.relative(outDir, file.path);

    const existing = await prisma.documentChunk.findFirst({
      where: { projectId, source: 'file', filePath: relPath },
    });
    if (existing) continue;

    const framed = `File: ${relPath}\n\`\`\`\n${file.content}\n\`\`\``;
    const chunks = chunkText(framed);

    for (const chunk of chunks) {
      allChunks.push({ sourcePath: relPath, text: chunk });
    }
  }

  if (allChunks.length === 0) {
    log.info({ projectId }, 'All files already indexed');
    return;
  }

  const texts = allChunks.map((c) => c.text);
  const embeddings = await generateEmbeddings(texts, resolvedOrgId);

  for (let i = 0; i < allChunks.length; i++) {
    await storeChunk(
      projectId,
      resolvedOrgId,
      'file',
      allChunks[i].sourcePath,
      allChunks[i].text,
      embeddings[i],
    );
  }

  log.info({ projectId, chunks: allChunks.length }, 'Output files indexed');
}

/**
 * Index a project's logs as document chunks.
 */
export async function indexProjectLogs(projectId: string, orgId?: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  const resolvedOrgId = orgId || project?.organizationId;
  if (!resolvedOrgId) {
    log.warn({ projectId }, 'No organization ID — skipping log index');
    return;
  }

  const logs = await prisma.projectLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: { agent: true, message: true, type: true, createdAt: true },
  });

  if (logs.length === 0) return;

  const conversation = logs
    .map((l) => `[${l.agent}] (${l.type}): ${l.message}`)
    .join('\n');

  if (!conversation.trim()) return;

  const existing = await prisma.documentChunk.findFirst({
    where: { projectId, source: 'log' },
  });
  if (existing) return;

  const chunkTexts = chunkText(conversation, 3000, 300);
  const embeddings = await generateEmbeddings(chunkTexts, resolvedOrgId);

  for (let i = 0; i < chunkTexts.length; i++) {
    await storeChunk(projectId, resolvedOrgId, 'log', null, chunkTexts[i], embeddings[i]);
  }

  log.info({ projectId, chunks: chunkTexts.length, totalLogs: logs.length }, 'Logs indexed');
}

/**
 * Full indexing pipeline for a completed project.
 * The orgId can be passed explicitly, or will be read from the project record.
 */
export async function indexProject(projectId: string, orgId?: string): Promise<void> {
  log.info({ projectId }, 'Starting full project indexing');

  try {
    await indexProjectIdea(projectId, orgId);
    await indexProjectOutput(projectId, orgId);
    await indexProjectLogs(projectId, orgId);
    log.info({ projectId }, 'Project indexing complete');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.error({ err: message, projectId }, 'Project indexing failed');
  }
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Walk a directory recursively and collect file contents.
 */
function walkDir(dir: string, baseDir: string, results: { path: string; content: string }[]): void {
  try {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.has(item)) {
          walkDir(full, baseDir, results);
        }
      } else {
        const ext = path.extname(item).toLowerCase();
        if (EXCLUDED_EXTS.has(ext)) continue;

        if (stat.size > 500 * 1024) continue;

        try {
          const content = fs.readFileSync(full, 'utf-8');
          results.push({ path: full, content });
        } catch {
          // Binary or unreadable file
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

/**
 * Store a document chunk with its embedding via raw SQL (pgvector compatibility).
 * Includes the organization_id for multi-tenant scoping.
 */
async function storeChunk(
  projectId: string,
  organizationId: string,
  source: string,
  filePath: string | null,
  content: string,
  embedding: number[],
): Promise<void> {
  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO document_chunks (id, project_id, organization_id, source, file_path, content, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
    id,
    projectId,
    organizationId,
    source,
    filePath,
    content,
    `[${embedding.join(',')}]`,
  );
}
