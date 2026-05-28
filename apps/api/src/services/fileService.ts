import fs from 'fs';
import path from 'path';
import { TreeNode } from '../types';

const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.next', 'dist']);

export function listAllFiles(dir: string, prefix = ''): string[] {
  const results: string[] = [];
  try {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      const rel = prefix ? `${prefix}/${item}` : item;
      if (fs.statSync(full).isDirectory() && !EXCLUDED_DIRS.has(item)) {
        results.push(rel + '/');
        results.push(...listAllFiles(full, rel));
      } else {
        results.push(rel);
      }
    }
  } catch {
    // Directory might not exist or be inaccessible
  }
  return results;
}

export function readDirectoryTree(dir: string): TreeNode[] {
  try {
    return fs
      .readdirSync(dir)
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          return { name, type: 'directory' as const, children: readDirectoryTree(full) };
        }
        return { name, type: 'file' as const, size: stat.size };
      })
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
  } catch {
    return [];
  }
}

export function findPackageJson(dir: string, depth = 0): string | null {
  if (depth > 4) return null;
  const direct = path.join(dir, 'package.json');
  if (fs.existsSync(direct)) return direct;
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (
        fs.statSync(full).isDirectory() &&
        name !== 'node_modules' &&
        name !== 'dist' &&
        name !== '.next' &&
        name !== '.git'
      ) {
        const found = findPackageJson(full, depth + 1);
        if (found) return found;
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return null;
}
