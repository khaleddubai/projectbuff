import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { getMissionOutputDir } from '../orchestrator';
import { findFreePort, killPort, healthCheck, getActiveServers } from '../services/portService';
import {
  ensureValidConfigs,
  fixPackageJson,
  detectProject,
  npmInstall,
  createEmergencyServer,
} from '../services/previewService';
import { childLogger } from '../utils/logger';

const router = Router();

router.post('/:id/preview', async (req: Request, res: Response) => {
  const id = req.params.id;
  const outDir = getMissionOutputDir(id);
  const logFile = path.join(outDir, 'preview.log');

  // Initialize log file
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(logFile, `=== ${id} ===\n${new Date().toISOString()}\n\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
    return;
  }

  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    try {
      fs.appendFileSync(logFile, line + '\n');
    } catch {
      // Log file may not be writable
    }
    childLogger('preview').info(msg);
  };

  // Fallback: serve static files if normal preview fails
  const emergency = async (reason: string) => {
    const ePort = await findFreePort(4001);
    killPort(ePort);
    const server = createEmergencyServer(outDir).listen(ePort, () => {
      log(`✅ Emergency fallback at http://localhost:${ePort} (reason: ${reason})`);
      res.json({
        success: true,
        url: `http://localhost:${ePort}`,
        type: 'emergency',
        reason,
        log: logFile,
      });
    });
    getActiveServers().set(ePort, server);
  };

  try {
    if (!fs.existsSync(outDir)) {
      res.status(404).json({ error: 'Output not found', code: 'NOT_FOUND' });
      return;
    }

    // Ensure valid frontend configs exist
    let frontendDir = path.join(outDir, 'frontend');
    if (!fs.existsSync(frontendDir)) {
      frontendDir = path.join(outDir, 'apps', 'web');
    }
    if (fs.existsSync(frontendDir)) {
      log('🛡️ Ensuring valid configs...');
      const fixes = ensureValidConfigs(frontendDir);
      fixes.forEach((f) => log(`   ${f}`));
    }

    // Find package.json
    let pkgPath: string | null = null;

    const candidates = [
      path.join(outDir, 'frontend', 'package.json'),
      path.join(outDir, 'apps', 'web', 'package.json'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        pkgPath = candidate;
        break;
      }
    }

    // Check root package.json for next/react
    if (!pkgPath && fs.existsSync(path.join(outDir, 'package.json'))) {
      try {
        const rootPkg = JSON.parse(fs.readFileSync(path.join(outDir, 'package.json'), 'utf-8'));
        if (rootPkg.dependencies?.next || rootPkg.dependencies?.react) {
          pkgPath = path.join(outDir, 'package.json');
        }
      } catch {
        // Invalid JSON
      }
    }

    // Fallback to backend package.json
    if (!pkgPath && fs.existsSync(path.join(outDir, 'backend', 'package.json'))) {
      pkgPath = path.join(outDir, 'backend', 'package.json');
    }

    if (!pkgPath) {
      await emergency('No package.json found');
      return;
    }

    // Fix and analyze package.json
    fixPackageJson(pkgPath);
    const cwd = path.dirname(pkgPath);
    log(`📦 ${path.relative(outDir, pkgPath)}`);

    const info = detectProject(pkgPath);
    log(`🔍 Detected: ${info.framework}`);

    // Find free port
    let port = info.port === 3001 ? 3000 : info.port;
    try {
      port = await findFreePort(port);
    } catch {
      port = await findFreePort(4001);
    }
    killPort(port);
    log(`🔌 Using port ${port}`);

    // Install dependencies
    log('📥 Installing dependencies...');
    if (!npmInstall(cwd, log)) {
      await emergency('npm install failed');
      return;
    }

    // Determine start script
    let pkg: Record<string, unknown> = {};
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch {
      // Use empty
    }

    const scripts = (pkg.scripts as Record<string, string>) || {};
    const scriptName = scripts.dev ? 'dev' : scripts.start ? 'start' : null;

    if (!scriptName) {
      await emergency('No dev or start script');
      return;
    }

    // Prepare environment and args
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      NODE_ENV: 'development',
    };
    env[info.portEnv] = String(port);

    const args = ['run', scriptName];
    if (info.portFlag) {
      args.push('--', '--port', String(port), '--host');
    }

    // Spawn preview server
    log(`🚀 npm ${args.join(' ')}`);
    const child = spawn('npm', args, {
      cwd,
      detached: true,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let exited = false;
    let exitCode: number | null = null;

    child.stdout?.on('data', (d: Buffer) => {
      const text = d.toString().trim();
      if (text) log(`[out] ${text.slice(-200)}`);
    });

    child.stderr?.on('data', (d: Buffer) => {
      const text = d.toString().trim();
      if (text) log(`[err] ${text.slice(-200)}`);
    });

    child.on('exit', (code) => {
      exited = true;
      exitCode = code;
    });

    child.unref();

    // Wait for server to start
    log('⏳ Waiting for server...');
    let alive = false;

    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      if (exited && exitCode !== 0 && i > 3) break;
      if (await healthCheck(port, 3000)) {
        alive = true;
        log(`✅ Server is up (attempt ${i + 1})`);
        break;
      }

      if ((i + 1) % 3 === 0) log(`⏳ Still waiting... (${i + 1}/15)`);
    }

    if (alive) {
      log(`🎉 Preview ready at http://localhost:${port}`);
      res.json({
        success: true,
        url: `http://localhost:${port}`,
        type: info.type,
        framework: info.framework,
        log: logFile,
      });
    } else {
      try {
        child.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      killPort(port);
      await emergency(`Server exited with code ${exitCode}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log(`💥 Error: ${message}`);
    try {
      await emergency(message);
    } catch {
      res.status(500).json({ error: message, code: 'PREVIEW_ERROR' });
    }
  }
});

export default router;
