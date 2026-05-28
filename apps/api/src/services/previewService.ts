import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import express from 'express';
import { ProjectInfo } from '../types';
import { listAllFiles } from './fileService';

const BAD_PACKAGES = [
  'shadcn/ui', 'shadcn', 'nextui', 'chakra',
  'mantine', 'antd', 'semantic-ui', 'material-ui', 'bootstrap',
];

const GUARANTEED_CONFIGS: Record<string, string> = {
  'next.config.js': [
    '/** @type {import(\'next\').NextConfig} */',
    'const nextConfig = { reactStrictMode: true };',
    'module.exports = nextConfig;',
    '',
  ].join('\n'),
  'tailwind.config.js': [
    '/** @type {import(\'tailwindcss\').Config} */',
    'module.exports = {',
    '  content: [',
    '    "./app/**/*.{js,ts,jsx,tsx,mdx}",',
    '    "./components/**/*.{js,ts,jsx,tsx,mdx}",',
    '  ],',
    '  theme: { extend: {} },',
    '  plugins: [],',
    '};',
    '',
  ].join('\n'),
  'postcss.config.js': [
    'module.exports = {',
    '  plugins: {',
    '    tailwindcss: {},',
    '    autoprefixer: {},',
    '  },',
    '};',
    '',
  ].join('\n'),
  'app/globals.css': [
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
    'body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; }',
    '',
  ].join('\n'),
};

export function ensureValidConfigs(frontendDir: string): string[] {
  const fixes: string[] = [];

  for (const [file, content] of Object.entries(GUARANTEED_CONFIGS)) {
    const fp = path.join(frontendDir, file);
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, content, 'utf-8');
    fixes.push(`Wrote ${file}`);
  }

  const layoutPath = path.join(frontendDir, 'app', 'layout.tsx');
  if (!fs.existsSync(layoutPath)) {
    const layoutContent = [
      'import type { Metadata } from "next";',
      'import "./globals.css";',
      '',
      'export const metadata: Metadata = {',
      '  title: "App | AEGIS",',
      '};',
      '',
      'export default function RootLayout({ children }: { children: React.ReactNode }) {',
      '  return (',
      '    <html lang="en">',
      '      <body className="bg-slate-950 text-slate-200 min-h-screen antialiased">{children}</body>',
      '    </html>',
      '  );',
      '}',
      '',
    ].join('\n');
    fs.writeFileSync(layoutPath, layoutContent, 'utf-8');
    fixes.push('Created layout.tsx');
  } else {
    const existing = fs.readFileSync(layoutPath, 'utf-8');
    if (!existing.includes('export default function')) {
      const layoutContent = [
        'import type { Metadata } from "next";',
        'import "./globals.css";',
        'export const metadata: Metadata = { title: "App | AEGIS" };',
        'export default function RootLayout({ children }: { children: React.ReactNode }) {',
        '  return (',
        '    <html lang="en"><body className="bg-slate-950 text-slate-200 min-h-screen antialiased">{children}</body></html>',
        '  );',
        '}',
        '',
      ].join('\n');
      fs.writeFileSync(layoutPath, layoutContent, 'utf-8');
      fixes.push('Fixed layout.tsx (missing export)');
    }
  }

  return fixes;
}

export function fixPackageJson(filePath: string): string[] {
  const changes: string[] = [];
  if (!fs.existsSync(filePath)) return ['Not found'];

  const raw = fs.readFileSync(filePath, 'utf-8');
  let pkg: Record<string, unknown>;

  try {
    pkg = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        pkg = JSON.parse(match[0]);
        changes.push('Extracted JSON from malformed file');
      } catch {
        pkg = {};
      }
    } else {
      pkg = {};
    }
  }

  if (!pkg || Object.keys(pkg).length === 0) {
    const defaultPkg = {
      name: 'app',
      version: '1.0.0',
      scripts: { dev: 'node server.js' },
      dependencies: { express: '^4.18.2' },
    };
    const serverJs = [
      "const express = require('express');",
      'const app = express();',
      "app.get('/', (req, res) => res.send('<h1>App Running</h1>'));",
      "app.listen(process.env.PORT || 3000, () => console.log('OK'));",
      '',
    ].join('\n');
    fs.writeFileSync(path.join(path.dirname(filePath), 'server.js'), serverJs, 'utf-8');
    fs.writeFileSync(filePath, JSON.stringify(defaultPkg, null, 2) + '\n', 'utf-8');
    return ['Replaced with default package.json'];
  }

  let modified = false;

  // Remove hallucinated packages
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const bad of BAD_PACKAGES) {
      if (deps[bad]) {
        delete deps[bad];
        changes.push(`Removed ${bad}`);
        modified = true;
      }
    }
  }

  // Ensure scripts field
  if (!pkg.scripts || typeof pkg.scripts !== 'object') {
    pkg.scripts = {};
    modified = true;
  }

  const scripts = pkg.scripts as Record<string, string>;
  if (!scripts.dev && !scripts.start) {
    const deps = { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) };
    scripts.dev = deps.next ? 'next dev' : 'node server.js';
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }

  return modified ? changes : ['Valid'];
}

export function detectProject(pkgPath: string): ProjectInfo {
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));    } catch {
      // JSON parse failed — use empty package info
    }

  const deps = {
    ...(pkg.dependencies as Record<string, string> || {}),
    ...(pkg.devDependencies as Record<string, string> || {}),
  };

  if (deps.next) return { type: 'nextjs', port: 3000, framework: 'Next.js', portFlag: false, portEnv: 'PORT' };
  if (deps.vite) return { type: 'vite', port: 5173, framework: 'Vite', portFlag: true, portEnv: 'VITE_PORT' };
  if (deps.express) return { type: 'express', port: 3000, framework: 'Express', portFlag: false, portEnv: 'PORT' };

  return { type: 'unknown', port: 3000, framework: 'Unknown', portFlag: false, portEnv: 'PORT' };
}

export function npmInstall(cwd: string, log: (m: string) => void): boolean {
  const strategies = [
    { flag: '--legacy-peer-deps', clean: false },
    { flag: '--force', clean: false },
    { flag: '--legacy-peer-deps', clean: true },
  ];

  for (const { flag, clean } of strategies) {
    try {
      if (clean) {
        try {
          fs.rmSync(path.join(cwd, 'node_modules'), { recursive: true, force: true });
        } catch {
          // node_modules may not exist — skip clean
        }
        try {
          fs.rmSync(path.join(cwd, 'package-lock.json'), { force: true });
        } catch {
          // lockfile may not exist — skip
        }
      }
      execSync(`npm install ${flag} 2>&1`, {
        cwd,
        timeout: 120000,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: 'pipe',
      });
      log('✅ npm install');
      return true;
    } catch {
      // Current npm install strategy failed — try next fallback
    }
  }
  return false;
}

export function createEmergencyServer(outDir: string): express.Application {
  const eApp = express();
  eApp.use(express.static(outDir, { index: false }));

  eApp.get('/', (_req, res) => {
    const files = listAllFiles(outDir);
    const icon = (f: string): string => {
      const ext = path.extname(f).toLowerCase();
      const iconMap: Record<string, string> = {
        '.ts': '🔷', '.tsx': '⚛️', '.js': '🟨',
        '.json': '📋', '.md': '📝', '.css': '🎨', '.html': '🌐',
      };
      return iconMap[ext] || '📄';
    };

    const rows = files
      .map((f) =>
        f.endsWith('/')
          ? `<tr><td class="p-2 border-b border-slate-700">📁</td><td class="p-2 border-b border-slate-700 font-mono text-sm text-cyan-400">${f.slice(0, -1)}/</td><td class="p-2 border-b border-slate-700 text-xs text-slate-500">Dir</td></tr>`
          : `<tr><td class="p-2 border-b border-slate-700">${icon(f)}</td><td class="p-2 border-b border-slate-700 font-mono text-sm"><a href="/${f}" class="text-slate-300 hover:text-cyan-400 no-underline">${f}</a></td><td class="p-2 border-b border-slate-700 text-xs text-slate-500">File</td></tr>`,
      )
      .join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AEGIS Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-200 font-sans">
  <div class="border-b border-slate-800 p-8" style="background: linear-gradient(135deg, #1e293b, #0f172a);">
    <h1 class="text-3xl font-bold text-cyan-400">🛡️ AEGIS Preview</h1>
    <p class="text-slate-400 mt-2">${files.length} files</p>
    <span class="inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">Diagnostic Mode</span>
  </div>
  <div class="p-8">
    <div class="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
      <h2 class="text-lg text-cyan-400 font-semibold mb-4">📂 Files</h2>
      <table class="w-full border-collapse">
        <thead>
          <tr class="text-xs uppercase text-slate-500 border-b-2 border-slate-700">
            <th class="p-2 text-left w-10"></th>
            <th class="p-2 text-left">Path</th>
            <th class="p-2 text-left w-20">Type</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="3" class="p-5 text-center text-slate-500">No files</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <div class="text-center p-6 text-slate-600 text-sm border-t border-slate-800">AEGIS v1.0</div>
</body>
</html>`);
  });

  return eApp;
}
