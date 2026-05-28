/**
 * AEGIS — Build Service
 *
 * Detects the build system of a generated project, installs dependencies,
 * runs type checks / builds, and parses errors into structured format
 * for the auto-fix loop.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { childLogger } from '../utils/logger';

const log = childLogger('build-service');

const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

/** Structured build error with file context */
export interface BuildError {
  /** Relative path to the file with the error */
  file: string;
  /** Line number (1-based, 0 if unknown) */
  line: number;
  /** Column number (0 if unknown) */
  column: number;
  /** Error message text */
  message: string;
  /** Error code (e.g. TS2322, ENOENT) */
  code: string;
}

/** Result of a build check */
export interface BuildCheckResult {
  /** Whether the build passed */
  success: boolean;
  /** Parsed errors */
  errors: BuildError[];
  /** Raw stdout from the command */
  stdout: string;
  /** Raw stderr from the command */
  stderr: string;
  /** Which command was run */
  command: string;
}

/** Detected project type for build commands */
export type ProjectType = 'nextjs' | 'express' | 'vite' | 'generic-node' | 'unknown';

/**
 * Detect project type from the output directory.
 */
export function detectProjectType(outDir: string): ProjectType {
  const pkgPath = path.join(outDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return 'unknown';

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    } as Record<string, string>;

    if (deps.next) return 'nextjs';
    if (deps.vite) return 'vite';
    if (deps.express || deps['@types/express']) return 'express';
    if (deps.typescript || deps.tsx) return 'generic-node';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Install npm dependencies with automatic fallback strategies.
 */
export function installDependencies(outDir: string): { success: boolean; output: string } {
  const pkgPath = path.join(outDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { success: true, output: 'No package.json — skipping install' };
  }

  const strategies = [
    { flag: '--legacy-peer-deps', clean: false },
    { flag: '--force', clean: false },
    { flag: '--legacy-peer-deps', clean: true },
  ];

  for (const { flag, clean } of strategies) {
    try {
      if (clean) {
        try { fs.rmSync(path.join(outDir, 'node_modules'), { recursive: true, force: true }); } catch { /* skip */ }
        try { fs.rmSync(path.join(outDir, 'package-lock.json'), { force: true }); } catch { /* skip */ }
      }

      const output = execSync(`npm install ${flag} 2>&1`, {
        cwd: outDir,
        timeout: 120_000,
        encoding: 'utf-8',
        maxBuffer: MAX_BUFFER,
        stdio: 'pipe',
      });

      log.info({ flag, clean }, 'npm install succeeded');
      return { success: true, output };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log.warn({ flag, clean, err: msg }, 'npm install attempt failed');
    }
  }

  return { success: false, output: 'All install strategies exhausted' };
}

/**
 * Determine the best build/type-check command for the project.
 * Returns null if no known build command applies.
 */
function getBuildCommand(outDir: string): string | null {
  const type = detectProjectType(outDir);

  switch (type) {
    case 'nextjs':
      return 'npx next build 2>&1';
    case 'express':
    case 'generic-node': {
      const tsConfigPath = path.join(outDir, 'tsconfig.json');
      if (fs.existsSync(tsConfigPath)) {
        return 'npx tsc --noEmit 2>&1';
      }
      return null; // Plain JS — no type checking available
    }
    case 'vite':
      return 'npx vite build 2>&1';
    default:
      return null;
  }
}

/**
 * Parse TypeScript/Node.js build errors from command output.
 */
function parseTypeScriptErrors(stdout: string, stderr: string): BuildError[] {
  const errors: BuildError[] = [];
  const combined = stdout + '\n' + stderr;

  // TypeScript format: "path/file.ts(line,col): error TS2345: Message"
  const tsRegex = /(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/g;
  let match: RegExpExecArray | null;
  while ((match = tsRegex.exec(combined)) !== null) {
    errors.push({
      file: path.normalize(match[1]),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[5],
      message: match[6].trim(),
    });
  }

  // ESLint/Next.js format: "Error: path/file.ts:line:col: Message"
  const genericRegex = /(?:Error|Warning):\s+(.+):(\d+):(\d+):\s+(.+)/g;
  while ((match = genericRegex.exec(combined)) !== null) {
    // Avoid duplicates from TS regex
    const file = path.normalize(match[1]);
    const line = parseInt(match[2], 10);
    const col = parseInt(match[3], 10);
    const msg = match[4].trim();

    if (!errors.some((e) => e.file === file && e.line === line && e.message === msg)) {
      errors.push({
        file,
        line,
        column: col,
        code: 'BUILD',
        message: msg,
      });
    }
  }

  // Module not found errors: "Cannot find module 'x'"
  if (combined.includes('Cannot find module')) {
    const moduleRegex = /Cannot find module ['"]([^'"]+)['"]/g;
    while ((match = moduleRegex.exec(combined)) !== null) {
      const modName = match[1];
      if (!errors.some((e) => e.message.includes(modName))) {
        errors.push({
          file: 'package.json',
          line: 0,
          column: 0,
          code: 'MODULE_NOT_FOUND',
          message: `Cannot find module '${modName}'`,
        });
      }
    }
  }

  return errors;
}

/**
 * Run a build/type-check on the output directory and parse any errors.
 */
export function checkBuild(outDir: string): BuildCheckResult {
  // First, make sure dependencies are installed
  const installResult = installDependencies(outDir);
  if (!installResult.success) {
    return {
      success: false,
      errors: [{ file: '', line: 0, column: 0, code: 'INSTALL_FAILED', message: installResult.output }],
      stdout: installResult.output,
      stderr: '',
      command: 'npm install',
    };
  }

  // Determine what command to run
  const buildCmd = getBuildCommand(outDir);
  if (!buildCmd) {
    log.info({ outDir }, 'No applicable build command — skipping build check');
    return {
      success: true,
      errors: [],
      stdout: '',
      stderr: '',
      command: 'none',
    };
  }

  try {
    const stdout = execSync(buildCmd, {
      cwd: outDir,
      timeout: 120_000,
      encoding: 'utf-8',
      maxBuffer: MAX_BUFFER,
      stdio: 'pipe',
    });

    log.info({ command: buildCmd }, 'Build check passed');
    return {
      success: true,
      errors: [],
      stdout,
      stderr: '',
      command: buildCmd,
    };
  } catch (err: unknown) {
    const execErr = err as {
      stdout?: string;
      stderr?: string;
      message?: string;
      status?: number;
    };

    const stdout = execErr.stdout || '';
    const stderr = execErr.stderr || '';
    const errors = parseTypeScriptErrors(stdout, stderr);

    log.warn(
      { command: buildCmd, errorCount: errors.length },
      'Build check failed',
    );

    return {
      success: false,
      errors,
      stdout,
      stderr,
      command: buildCmd,
    };
  }
}

/**
 * Format build errors into a human-readable summary for LLM prompts.
 */
export function formatBuildErrors(result: BuildCheckResult): string {
  if (result.success) return '✅ Build passed with zero errors.\n';

  const lines: string[] = [];
  lines.push(`❌ Build failed (exit code).`);
  lines.push(`Command: ${result.command}`);
  lines.push('');

  if (result.errors.length === 0) {
    lines.push('Raw stderr:');
    lines.push(result.stderr.slice(0, 2000));
    return lines.join('\n') + '\n';
  }

  lines.push(`Found ${result.errors.length} error(s):`);
  lines.push('');

  for (const err of result.errors) {
    const loc = err.file ? `${err.file}${err.line ? `:${err.line}:${err.column}` : ''}` : '(unknown)';
    lines.push(`  ${loc} — ${err.code}: ${err.message}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('Complete output:');
  lines.push(result.stderr.slice(0, 3000));

  return lines.join('\n') + '\n';
}
