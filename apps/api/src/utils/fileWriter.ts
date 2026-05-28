import fs from 'fs';
import path from 'path';

// Matches file-header comment lines like:
//   // path/to/file
//   # path/to/file
//   <!-- path/to/file -->
const FILE_HEADER_RE = /^\s*(?:(?:\/\/|#)\s+|<!--\s+)([\w.\/\\-]+(?:\.[\w]+)?)(?:\s*-->)?\s*$/;

/**
 * Given the raw content of a <FILE> block, check if it contains multiple files
 * separated by comment-style headers (e.g., "// path/to/file").
 * If so, split and return [{path, content}, ...]. Otherwise return null.
 */
function splitMultiFileBlock(raw: string): Array<{ path: string; content: string }> | null {
  const lines = raw.split('\n');
  const headerIndices: number[] = [];
  const headerPaths: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(FILE_HEADER_RE);
    if (match) {
      const p = match[1].trim();
      // Only treat as file header if it looks like a file path (has extension or path separator)
      if (p.includes('.') || p.includes('/') || p.includes('\\')) {
        headerIndices.push(i);
        headerPaths.push(p);
      }
    }
  }

  // Need at least 2 headers to be a multi-file block
  if (headerIndices.length < 2) return null;

  const files: Array<{ path: string; content: string }> = [];
  for (let i = 0; i < headerIndices.length; i++) {
    const startLine = headerIndices[i] + 1;
    const endLine = i < headerIndices.length - 1 ? headerIndices[i + 1] : lines.length;
    const content = lines.slice(startLine, endLine).join('\n').trim();
    if (content) {
      files.push({ path: headerPaths[i], content });
    }
  }

  return files.length >= 2 ? files : null;
}

function writeFile(baseDir: string, filePath: string, content: string, written: string[]): void {
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
    console.warn(`[Parser] Rejected path: "${normalizedPath}"`);
    return;
  }

  let raw = content.trim();

  // Strip outer code fences
  const codeFenceRegex = /^```[\w]*\s*\n/;
  const codeFenceMatch = raw.match(codeFenceRegex);
  if (codeFenceMatch) {
    raw = raw.slice(codeFenceMatch[0].length);
    const lastFence = raw.lastIndexOf('\n```');
    if (lastFence !== -1) {
      raw = raw.slice(0, lastFence);
    } else if (raw.endsWith('```')) {
      raw = raw.slice(0, -3);
    }
    raw = raw.trim();
  }

  if (!raw) {
    console.warn(`[Parser] Empty content: "${normalizedPath}"`);
    return;
  }

  try {
    const fullPath = path.join(baseDir, normalizedPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!raw.endsWith('\n')) raw += '\n';
    fs.writeFileSync(fullPath, raw, 'utf-8');
    written.push(normalizedPath);
    console.log(`[Parser] Written: ${normalizedPath} (${raw.length} bytes)`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Parser] Failed: "${normalizedPath}": ${errMsg}`);
  }
}

export function parseAndWriteFiles(content: string, baseDir: string): string[] {
  const written: string[] = [];
  let searchPos = 0;
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  while (true) {
    const tagOpen = content.indexOf('<FILE path="', searchPos);
    if (tagOpen === -1) break;

    const pathStart = tagOpen + '<FILE path="'.length;
    const pathEndQuote = content.indexOf('">', pathStart);
    if (pathEndQuote === -1) break;

    const filePath = content.slice(pathStart, pathEndQuote).trim();
    
    if (!filePath || filePath.includes('..') || filePath.startsWith('/')) {
      console.warn(`[Parser] Rejected path: "${filePath}"`);
      searchPos = pathEndQuote + 2;
      continue;
    }

    const normalizedPath = filePath.replace(/\\/g, '/');
    const contentStart = pathEndQuote + '">'.length;
    const tagClose = content.indexOf('</FILE>', contentStart);
    if (tagClose === -1) {
      console.warn(`[Parser] Missing closing tag for: "${normalizedPath}"`);
      break;
    }

    const rawContent = content.slice(contentStart, tagClose).trim();

    // Try to split multi-file blocks (comment-header style)
    const multiFiles = splitMultiFileBlock(rawContent);
    if (multiFiles) {
      for (const f of multiFiles) {
        writeFile(baseDir, f.path, f.content, written);
      }
    } else {
      writeFile(baseDir, normalizedPath, rawContent, written);
    }

    searchPos = tagClose + '</FILE>'.length;
  }

  return written;
}

export function parseBattlePlan(content: string): Record<string, unknown> | null {
  const codeBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1]); } catch {}
  }

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end === -1 || start >= end) return null;

  const candidate = content.slice(start, end + 1);
  try { return JSON.parse(candidate); } catch {
    const fixed = candidate.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/\\n/g, '\\\\n');
    try { return JSON.parse(fixed); } catch { return null; }
  }
}
