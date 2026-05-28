#!/bin/bash
# ============================================================
# AEGIS v0.0.4 - BUG FIXES & STABILITY UPDATE
# ============================================================

set -e
echo "🛡️  AEGIS v0.0.4 Fix Script"
echo "=============================="
echo ""

# Navigate to project root
cd ~/Desktop/aegis

# ============================================================
# 1. Fix Prompts
# ============================================================
echo "📝 [1/8] Updating agent prompts..."

cat > apps/api/src/agents/prompts.ts << 'PROMPTEOF'
const FILE_EXAMPLE = `
CRITICAL RULES FOR FILE GENERATION:
1. Use EXACTLY this format for every file:
<FILE path="relative/path/from/project/root">
\`\`\`language
content here
\`\`\`
</FILE>
2. NEVER output text outside <FILE> blocks. No explanations, no markdown.
3. ALWAYS generate a valid package.json with real npm packages.
4. NEVER use "shadcn/ui" as an npm package name. Use individual packages.
5. NEVER include packages with slashes except @scoped/packages.
6. ALL packages MUST exist on npm registry.
7. EVERY package.json MUST have a "scripts" field with at least "dev".
`;

export const CONDUCTOR_PROMPT = `
You are THE CONDUCTOR of Aegis. Output ONLY a strict JSON battle plan inside a markdown code block. No other text.

Schema:
{
  "projectName": "kebab-case-name",
  "objective": "Short objective.",
  "phases": [
    { "phase": "architecture", "agent": "architect", "deliverables": ["docs/architecture.md", "prisma/schema.prisma"] },
    { "phase": "backend", "agent": "backendEngineer", "deliverables": ["apps/api/src/server.ts", "apps/api/package.json"] },
    { "phase": "frontend", "agent": "frontendEngineer", "deliverables": ["apps/web/app/page.tsx", "apps/web/package.json"] },
    { "phase": "devops", "agent": "devOps", "deliverables": ["Dockerfile", "docker-compose.yml"] },
    { "phase": "qa", "agent": "qaEngineer", "deliverables": ["tests/e2e/app.test.ts"] },
    { "phase": "docs", "agent": "techWriter", "deliverables": ["README.md"] }
  ]
}
`;

export const ARCHITECT_PROMPT = `You are the PRINCIPAL SOLUTION ARCHITECT. Design HLD/LLD, DB schema, API contracts.
For Prisma schema: Use direct connection strings (not env()), add @relation names to all relations.
` + FILE_EXAMPLE;

export const BACKEND_PROMPT = `You are the PRINCIPAL BACKEND ENGINEER. Write Express + Zod + TypeScript.
MANDATORY package.json dependencies: express, cors, dotenv, zod, tsx, typescript, @types/express, @types/cors, @types/node.
MUST include scripts: { "dev": "tsx watch src/server.ts" }
` + FILE_EXAMPLE;

export const FRONTEND_PROMPT = `You are the PRINCIPAL FRONTEND ENGINEER. Next.js 14 + Tailwind + shadcn/ui components.
MANDATORY package.json dependencies: next, react, react-dom, lucide-react, class-variance-authority, clsx, tailwind-merge, tailwindcss, autoprefixer, postcss, typescript, @types/node, @types/react, @types/react-dom.
NEVER include "shadcn/ui" as a package. Use individual @radix-ui packages instead.
MUST include scripts: { "dev": "next dev -p 3000" }
` + FILE_EXAMPLE;

export const DEVOPS_PROMPT = `You are the PRINCIPAL DEVOPS ENGINEER. Generate Dockerfile, docker-compose.yml, CI/CD.
` + FILE_EXAMPLE;

export const QA_PROMPT = `You are the PRINCIPAL QA ENGINEER. Write Vitest and Playwright tests. MUST generate at least ONE test file.
` + FILE_EXAMPLE;

export const TECH_WRITER_PROMPT = `You are the PRINCIPAL TECHNICAL WRITER. Write README.md and API docs.
` + FILE_EXAMPLE;
PROMPTEOF

echo "   ✅ Prompts updated"

# ============================================================
# 2. Fix File Writer
# ============================================================
echo "📝 [2/8] Upgrading file parser..."

cat > apps/api/src/utils/fileWriter.ts << 'WRITEREOF'
import fs from 'fs';
import path from 'path';

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

    let raw = content.slice(contentStart, tagClose).trim();
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

    if (!raw.trim()) {
      console.warn(`[Parser] Empty content: "${normalizedPath}"`);
      searchPos = tagClose + '</FILE>'.length;
      continue;
    }

    try {
      const fullPath = path.join(baseDir, normalizedPath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!raw.endsWith('\n')) raw += '\n';
      fs.writeFileSync(fullPath, raw, 'utf-8');
      written.push(normalizedPath);
      console.log(`[Parser] Written: ${normalizedPath} (${raw.length} bytes)`);
    } catch (err: any) {
      console.error(`[Parser] Failed: "${normalizedPath}": ${err.message}`);
    }

    searchPos = tagClose + '</FILE>'.length;
  }

  return written;
}

export function parseBattlePlan(content: string): any {
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
WRITEREOF

echo "   ✅ File parser upgraded"

# ============================================================
# 3. Fix Orchestrator
# ============================================================
echo "📝 [3/8] Upgrading orchestrator..."

cat > apps/api/src/orchestrator.ts << 'ORCHEOF'
import { OpenAI } from 'openai';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import db from './db';
import { parseAndWriteFiles, parseBattlePlan } from './utils/fileWriter';
import { zipDirectory } from './utils/zipper';
import {
  CONDUCTOR_PROMPT, ARCHITECT_PROMPT, BACKEND_PROMPT,
  FRONTEND_PROMPT, DEVOPS_PROMPT, QA_PROMPT, TECH_WRITER_PROMPT,
} from './agents/prompts';

export const aegisEvents = new EventEmitter();
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
console.log('[Aegis] PROJECT_ROOT:', PROJECT_ROOT);

function getLLMConfig() {
  const baseUrlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENROUTER_BASE_URL') as any;
  const apiKeyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENROUTER_API_KEY') as any;
  const modelRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENROUTER_MODEL') as any;
  return {
    baseURL: baseUrlRow?.value || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: apiKeyRow?.value || process.env.OPENROUTER_API_KEY || '',
    model: modelRow?.value || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
  };
}

async function chatWithRetry(system: string, user: string, temp = 0.2, retries = 3): Promise<string> {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      const cfg = getLLMConfig();
      if (!cfg.apiKey || cfg.apiKey.trim() === '') throw new Error('No API key configured');
      const openai = new OpenAI({
        baseURL: cfg.baseURL, apiKey: cfg.apiKey,
        defaultHeaders: { 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Aegis' },
      });
      const resp = await openai.chat.completions.create({
        model: cfg.model, temperature: temp, max_tokens: 16000,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      });
      const text = resp.choices[0]?.message?.content || '';
      if (!text || text.trim().length < 10) throw new Error('Empty response');
      return text;
    } catch (err: any) {
      lastErr = err;
      const msg = err.message || '';
      const status = err.status || err.response?.status || 0;
      const is429 = status === 429 || msg.includes('429') || msg.includes('rate limit');
      const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || status === 502 || status === 503 || is429 || msg.includes('no body');
      if (isTransient && i < retries - 1) {
        const delay = is429 ? 30000 * (i + 1) : 3000 * Math.pow(2, i);
        console.warn(`[Aegis] Retry ${i + 2}/${retries} in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('All retries exhausted');
}

function logEvent(projectId: string, agent: string, message: string, type: 'info' | 'file' | 'error' = 'info') {
  db.prepare('INSERT INTO project_logs (project_id, agent, message, type) VALUES (?, ?, ?, ?)').run(projectId, agent, message, type);
  aegisEvents.emit('update', { projectId, agent, message, type, timestamp: new Date().toISOString() });
}

export function getMissionOutputDir(projectId: string): string {
  return path.join(PROJECT_ROOT, 'output', projectId);
}

function fixPrismaSchema(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  if (content.includes('env(')) {
    content = content.replace(/url\s*=\s*env\(["'][^"']+["']\)/g, 'url = "postgresql://localhost:5432/mydb?schema=public"');
    modified = true;
  }
  let counter = 1;
  content = content.replace(/@relation\(\)/g, () => `@relation("Relation${counter++}")`);
  if (counter > 1) modified = true;
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('[Aegis] Patched Prisma schema:', filePath);
  }
}

function fixPackageJson(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let modified = false;
    if (!pkg.scripts) { pkg.scripts = {}; modified = true; }
    if (!pkg.scripts.dev && !pkg.scripts.start) {
      pkg.scripts.dev = filePath.includes('/api') ? 'tsx watch src/server.ts' : 'next dev -p 3000';
      modified = true;
    }
    const badPackages = ['shadcn/ui', 'shadcn', 'nextui', 'chakra', 'mantine', 'antd', 'semantic-ui', 'material-ui', 'bootstrap'];
    ['dependencies', 'devDependencies'].forEach(field => {
      if (!pkg[field]) return;
      for (const bad of badPackages) {
        if (pkg[field][bad]) { delete pkg[field][bad]; modified = true; }
      }
    });
    if (modified) fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  } catch {}
}

export async function runMission(projectId: string, idea: string) {
  try {
    const outDir = getMissionOutputDir(projectId);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    console.log(`[Aegis] Mission ${projectId} -> ${outDir}`);

    logEvent(projectId, 'conductor', 'Analyzing mission...', 'info');
    let planRaw: string;
    try {
      planRaw = await chatWithRetry(CONDUCTOR_PROMPT, 'Director Idea: ' + idea + '\n\nReturn ONLY JSON inside a markdown code block.');
    } catch (e: any) {
      logEvent(projectId, 'conductor', 'LLM failed: ' + e.message, 'error');
      throw new Error('Conductor unreachable: ' + e.message);
    }

    let plan = parseBattlePlan(planRaw);
    if (!plan) {
      logEvent(projectId, 'conductor', 'Parse failed, retrying...', 'error');
      planRaw = await chatWithRetry(CONDUCTOR_PROMPT, 'CRITICAL: Return ONLY valid JSON. Idea: ' + idea);
      plan = parseBattlePlan(planRaw);
    }
    if (!plan) throw new Error('Failed to parse battle plan');

    const projectName = plan.projectName || 'untitled-project';
    db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(projectName, projectId);
    logEvent(projectId, 'conductor', `Battle plan: "${projectName}" - ${(plan.phases || []).length} phases`, 'info');

    for (const phase of (plan.phases || [])) {
      const agentKey: string = phase.agent;
      let system = '';
      switch (agentKey) {
        case 'architect': system = ARCHITECT_PROMPT; break;
        case 'backendEngineer': system = BACKEND_PROMPT; break;
        case 'frontendEngineer': system = FRONTEND_PROMPT; break;
        case 'devOps': system = DEVOPS_PROMPT; break;
        case 'qaEngineer': system = QA_PROMPT; break;
        case 'techWriter': system = TECH_WRITER_PROMPT; break;
        default: continue;
      }
      if (!system) continue;

      logEvent(projectId, agentKey, `Starting ${phase.phase}...`, 'info');
      let response: string;
      try {
        response = await chatWithRetry(system, `Phase: ${phase.phase}\nDeliverables: ${(phase.deliverables || []).join(', ')}`);
      } catch (e: any) {
        logEvent(projectId, agentKey, 'Failed: ' + e.message, 'error');
        continue;
      }

      let written = parseAndWriteFiles(response, outDir);
      let retryCount = 0;
      while (written.length === 0 && retryCount < 2) {
        retryCount++;
        logEvent(projectId, agentKey, `Zero files. Retry ${retryCount}/2...`, 'error');
        try {
          response = await chatWithRetry(system, 'CRITICAL: Output at least one <FILE> block.');
          written = parseAndWriteFiles(response, outDir);
        } catch { break; }
      }

      for (const file of written) {
        const fullPath = path.join(outDir, file);
        if (file.includes('schema.prisma')) fixPrismaSchema(fullPath);
        if (file.includes('package.json')) fixPackageJson(fullPath);
      }

      if (written.length > 0) {
        logEvent(projectId, agentKey, `Delivered ${written.length} files: ${written.join(', ')}`, 'file');
      } else {
        logEvent(projectId, agentKey, 'No artifacts.', 'info');
      }
    }

    // Security audit
    logEvent(projectId, 'securityEngineer', 'Running security audit...', 'info');
    const findings: string[] = [];
    try {
      const walkDir = (dir: string) => {
        for (const item of fs.readdirSync(dir)) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            if (item !== 'node_modules' && item !== '.git' && item !== '.next' && item !== 'dist') walkDir(full);
          } else {
            const ext = path.extname(item).toLowerCase();
            if (['.png', '.jpg', '.ico', '.woff', '.woff2'].includes(ext)) continue;
            try {
              const c = fs.readFileSync(full, 'utf-8');
              if (/password\s*[=:]\s*["'][^"']{3,}["']/i.test(c)) findings.push(`[SECRET] password in ${item}`);
              if (/api[_-]?key\s*[=:]\s*["'][^"']{8,}["']/i.test(c)) findings.push(`[SECRET] API key in ${item}`);
              if (/eval\s*\(/i.test(c)) findings.push(`[DANGER] eval() in ${item}`);
              if (/innerHTML\s*=/.test(c)) findings.push(`[XSS] innerHTML in ${item}`);
            } catch {}
          }
        }
      };
      walkDir(outDir);
    } catch {}

    if (findings.length > 0) {
      fs.writeFileSync(path.join(outDir, 'SECURITY_AUDIT.md'), '# Security Audit\n\n' + findings.join('\n'), 'utf-8');
      logEvent(projectId, 'securityEngineer', `Found ${findings.length} issues.`, 'error');
    } else {
      logEvent(projectId, 'securityEngineer', 'Scan clean.', 'info');
    }

    const zipPath = path.join(PROJECT_ROOT, 'output', projectName + '.zip');
    await zipDirectory(outDir, zipPath);
    db.prepare('UPDATE projects SET status = ?, output_path = ? WHERE id = ?').run('completed', zipPath, projectId);
    logEvent(projectId, 'conductor', 'Mission complete!', 'info');
    console.log(`[Aegis] Done: ${zipPath}`);

  } catch (err: any) {
    logEvent(projectId, 'system', 'Critical failure: ' + err.message, 'error');
    db.prepare('UPDATE projects SET status = ? WHERE id = ?').run('failed', projectId);
    console.error(`[Aegis] FAILED:`, err.message);
  }
}
ORCHEOF

echo "   ✅ Orchestrator upgraded"

# ============================================================
# 4. Fix Server
# ============================================================
echo "📝 [4/8] Upgrading server..."

cat > apps/api/src/index.ts << 'INDEXEOF'
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import db from './db';
import { runMission, aegisEvents, getMissionOutputDir } from './orchestrator';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

function readDirRecursive(dir: string): any[] {
  try {
    return fs.readdirSync(dir).map(name => {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) return { name, type: 'directory', children: readDirRecursive(full) };
      return { name, type: 'file', size: stat.size };
    }).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch { return []; }
}

function findPackageJson(dir: string, depth = 0): string | null {
  if (depth > 4) return null;
  const direct = path.join(dir, 'package.json');
  if (fs.existsSync(direct)) return direct;
  try {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory() && name !== 'node_modules' && name !== 'dist' && name !== '.next' && name !== '.git') {
        const found = findPackageJson(full, depth + 1);
        if (found) return found;
      }
    }
  } catch {}
  return null;
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => { tester.close(() => resolve(true)); });
    tester.listen(port, '127.0.0.1');
  });
}

async function findFreePort(start: number): Promise<number> {
  let p = start;
  while (!(await isPortFree(p))) p++;
  return p;
}

app.post('/api/missions', async (req, res) => {
  const { idea } = req.body;
  if (!idea || typeof idea !== 'string' || idea.trim().length < 3) {
    return res.status(400).json({ error: 'Idea must be at least 3 characters' });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id, name, idea, status) VALUES (?, ?, ?, ?)').run(id, 'pending', idea, 'running');
  res.json({ id, status: 'running' });
  runMission(id, idea).catch(err => console.error(`[Aegis] Mission ${id} failed:`, err.message));
});

app.get('/api/missions/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Mission not found' });
  const logs = db.prepare('SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ project, logs });
});

app.get('/api/missions/:id/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  const onUpdate = (data: any) => {
    if (data.projectId === req.params.id) res.write('data: ' + JSON.stringify(data) + '\n\n');
  };
  aegisEvents.on('update', onUpdate);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => {
    aegisEvents.removeListener('update', onUpdate);
    clearInterval(heartbeat);
  });
});

app.get('/api/missions/:id/download', (req, res) => {
  const project: any = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project || project.status !== 'completed' || !project.output_path) {
    return res.status(400).json({ error: 'Build not ready' });
  }
  if (!fs.existsSync(project.output_path)) return res.status(404).json({ error: 'ZIP missing' });
  res.download(project.output_path, path.basename(project.output_path));
});

app.get('/api/missions/:id/files', (req, res) => {
  const outDir = getMissionOutputDir(req.params.id);
  if (!fs.existsSync(outDir)) return res.status(404).json({ error: 'Not found' });
  res.json({ tree: readDirRecursive(outDir) });
});

app.get('/api/missions/:id/content', (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'Missing path' });
  const outDir = getMissionOutputDir(req.params.id);
  const target = path.join(outDir, filePath);
  if (!target.startsWith(outDir)) return res.status(400).json({ error: 'Invalid path' });
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return res.status(404).json({ error: 'Not found' });
  if (fs.statSync(target).size > 1024 * 1024) return res.status(400).json({ error: 'File too large' });
  res.json({ content: fs.readFileSync(target, 'utf-8'), path: filePath });
});

app.get('/api/missions/:id/security', (req, res) => {
  const outDir = getMissionOutputDir(req.params.id);
  const auditPath = path.join(outDir, 'SECURITY_AUDIT.md');
  if (!fs.existsSync(auditPath)) return res.json({ clean: true, findings: [] });
  const content = fs.readFileSync(auditPath, 'utf-8');
  const findings = content.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
  res.json({ clean: findings.length === 0, findings });
});

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

app.post('/api/settings/bulk', (req, res) => {
  const body = req.body as Record<string, string>;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  const tx = db.transaction(() => { for (const [k, v] of Object.entries(body)) stmt.run(k, v); });
  try { tx(); res.json({ success: true }); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/missions/:id/preview', async (req, res) => {
  const id = req.params.id;
  const outDir = getMissionOutputDir(id);
  const logFile = path.join(outDir, 'preview.log');
  try { fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(logFile, `Preview Log - ${id}\n${new Date().toISOString()}\n---\n`); } catch (e: any) { return res.status(500).json({ error: e.message }); }
  const log = (msg: string) => { try { fs.appendFileSync(logFile, msg + '\n'); } catch {} };

  try {
    if (!fs.existsSync(outDir)) { log('FAIL: No output dir'); return res.status(404).json({ error: 'Output not found' }); }
    const pkgPath = findPackageJson(outDir);
    if (!pkgPath) { log('FAIL: No package.json'); return res.status(400).json({ error: 'No package.json' }); }
    const cwd = path.dirname(pkgPath);
    const port = await findFreePort(4001);
    log(`CWD: ${cwd}, Port: ${port}`);

    log('npm install...');
    try { execSync('npm install --legacy-peer-deps', { cwd, stdio: 'pipe', timeout: 120000 }); log('npm install OK'); }
    catch (e: any) {
      log('npm install failed, trying --force...');
      try { execSync('npm install --force', { cwd, stdio: 'pipe', timeout: 120000 }); log('npm install OK (forced)'); }
      catch (e2: any) { log('npm install completely failed'); return res.status(500).json({ error: 'npm install failed', log: logFile }); }
    }

    for (const pd of [path.join(cwd, 'prisma'), path.join(cwd, '..', 'prisma'), path.join(outDir, 'prisma')]) {
      if (fs.existsSync(path.join(pd, 'schema.prisma'))) {
        try { execSync('npx prisma generate', { cwd: pd, stdio: 'pipe', timeout: 60000 }); log('prisma generate OK'); } catch {}
        break;
      }
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    const script = pkg.scripts?.dev ? 'dev' : pkg.scripts?.start ? 'start' : null;
    if (!script) { log('No dev/start script'); return res.status(400).json({ error: 'No dev/start script' }); }

    log(`Starting: npm run ${script}`);
    const child = spawn('npm', ['run', script], { cwd, detached: true, shell: true, stdio: 'ignore', env: { ...process.env, PORT: String(port) } });
    child.unref();
    await new Promise(r => setTimeout(r, 8000));

    let alive = false;
    for (let i = 0; i < 5; i++) {
      try { await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(3000) }); alive = true; break; } catch { await new Promise(r => setTimeout(r, 2000)); }
    }

    if (alive) res.json({ success: true, url: `http://localhost:${port}`, log: logFile });
    else { try { child.kill('SIGTERM'); } catch {} res.status(500).json({ error: 'Preview did not start', log: logFile }); }
  } catch (e: any) { log(`FATAL: ${e.message}`); res.status(500).json({ error: e.message, log: logFile }); }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', version: '0.0.4' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Aegis API v0.0.4 on port ' + PORT));
INDEXEOF

echo "   ✅ Server upgraded"

# ============================================================
# 5. Create output dir
# ============================================================
echo "📁 [5/8] Creating output directory..."
mkdir -p output
echo "   ✅ output/ ready"

# ============================================================
# 6. Update versions
# ============================================================
echo "📝 [6/8] Updating versions..."
if [ -f apps/web/dashboard.html ]; then
  sed -i '' 's/AEGIS v0.0.1/AEGIS v0.0.4/g' apps/web/dashboard.html 2>/dev/null || true
fi
if [ -f aegis.html ]; then
  sed -i '' 's/AEGIS v0.0.1/AEGIS v0.0.4/g' aegis.html 2>/dev/null || true
fi
echo "   ✅ Versions updated"

# ============================================================
# 7. Install deps
# ============================================================
echo "📦 [7/8] Installing dependencies..."
cd apps/api && npm install 2>&1 | tail -3
cd ../..
echo "   ✅ Dependencies installed"

# ============================================================
# 8. Verify
# ============================================================
echo "🔍 [8/8] Verifying..."
for f in apps/api/src/agents/prompts.ts apps/api/src/utils/fileWriter.ts apps/api/src/orchestrator.ts apps/api/src/index.ts apps/api/src/db.ts apps/api/src/utils/zipper.ts apps/api/package.json apps/api/.env.example; do
  if [ -f "$f" ]; then echo "   ✅ $f"; else echo "   ❌ MISSING: $f"; fi
done

echo ""
echo "============================================================"
echo " 🛡️  AEGIS v0.0.4 FIX COMPLETE"
echo "============================================================"
echo ""
echo "Fixes applied:"
echo " ✅ Prompts enforce valid npm packages (no shadcn/ui)"
echo " ✅ File parser handles edge cases"
echo " ✅ Prisma v7 auto-patching"
echo " ✅ package.json auto-fix (hallucinated packages removed)"
echo " ✅ Better retry logic with timeouts"
echo " ✅ SSE heartbeat prevents disconnection"
echo " ✅ npm install with fallbacks"
echo " ✅ Security audit improved"
echo ""
echo "Next: Edit .env and start the servers:"
echo "  nano apps/api/.env"
echo "  cd apps/api && npm run dev"
echo "  # new terminal:"
echo "  cd apps/web && npm run dev"
echo "============================================================"
