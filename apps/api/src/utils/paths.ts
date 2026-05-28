/**
 * AEGIS — Project Path Resolution
 *
 * Shared utility for resolving project root and output directories.
 * Extracted from orchestrator.ts to avoid circular dependencies with indexer.ts.
 *
 * NOTE: This file lives at apps/api/src/utils/ which is one level deeper
 * than apps/api/src/ where the original function lived. Adjust .. counts accordingly.
 */

import path from 'path';
import fs from 'fs';

/**
 * Resolve the project root directory by walking up from __dirname until
 * we find a directory containing apps/api/package.json or setup.py.
 *
 * Falls back to AEGIS_OUTPUT_DIR env var (Docker override) if set.
 */
export function resolveProjectRoot(): string {
  // Explicit override — used in Docker production
  if (process.env.AEGIS_OUTPUT_DIR) {
    return process.env.AEGIS_OUTPUT_DIR;
  }

  // Walk up from __dirname to find the project root
  let dir = __dirname;
  const root = path.parse(dir).root;
  while (dir !== root) {
    if (
      fs.existsSync(path.join(dir, 'apps', 'api', 'package.json')) ||
      fs.existsSync(path.join(dir, 'setup.py'))
    ) {
      return dir;
    }
    dir = path.resolve(dir, '..');
  }

  // Fallback — process.cwd() is usually the project root when run via npm
  console.warn('[paths] Could not auto-detect project root via sentinel files, falling back to cwd:', process.cwd());
  return process.cwd();
}

export const PROJECT_ROOT = resolveProjectRoot();

/**
 * Get the output directory for a specific mission/project.
 */
export function getMissionOutputDir(projectId: string): string {
  return path.join(PROJECT_ROOT, 'output', projectId);
}
