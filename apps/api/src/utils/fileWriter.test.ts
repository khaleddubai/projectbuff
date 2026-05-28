import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { parseAndWriteFiles, parseBattlePlan } from './fileWriter';

describe('parseAndWriteFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should parse a single FILE block and write it to disk', () => {
    const content = `<FILE path="hello.txt">
\`\`\`
Hello, world!
\`\`\`
</FILE>`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(1);
    expect(written[0]).toBe('hello.txt');

    const fileContent = fs.readFileSync(path.join(tmpDir, 'hello.txt'), 'utf-8');
    expect(fileContent).toContain('Hello, world!');
  });

  it('should parse multiple FILE blocks', () => {
    const content = `
<FILE path="file1.txt">
\`\`\`
Content 1
\`\`\`
</FILE>
<FILE path="sub/file2.txt">
\`\`\`
Content 2
\`\`\`
</FILE>
`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(2);
    expect(written).toContain('file1.txt');
    expect(written).toContain('sub/file2.txt');

    expect(fs.readFileSync(path.join(tmpDir, 'file1.txt'), 'utf-8')).toContain('Content 1');
    expect(fs.readFileSync(path.join(tmpDir, 'sub', 'file2.txt'), 'utf-8')).toContain('Content 2');
  });

  it('should handle nested directory paths', () => {
    const content = `<FILE path="a/b/c/deep.txt">
\`\`\`
Deep file
\`\`\`
</FILE>`;

    parseAndWriteFiles(content, tmpDir);
    const filePath = path.join(tmpDir, 'a', 'b', 'c', 'deep.txt');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toContain('Deep file');
  });

  it('should reject paths with directory traversal', () => {
    const content = `<FILE path="../../evil.txt">
\`\`\`
Evil content
\`\`\`
</FILE>`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(0);
  });

  it('should reject absolute paths', () => {
    const content = `<FILE path="/etc/passwd">
\`\`\`
Hack attempt
\`\`\`
</FILE>`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(0);
  });

  it('should reject empty file content', () => {
    const content = `<FILE path="empty.txt">
\`\`\`

\`\`\`
</FILE>`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(0);
  });

  it('should handle files without code fences', () => {
    const content = `<FILE path="raw.txt">
Just raw text content
</FILE>`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmpDir, 'raw.txt'), 'utf-8')).toContain('Just raw text');
  });

  it('should handle content with trailing newline', () => {
    const content = `<FILE path="trailing.txt">
\`\`\`
Line 1
Line 2
\`\`\`
</FILE>`;

    parseAndWriteFiles(content, tmpDir);
    const fileContent = fs.readFileSync(path.join(tmpDir, 'trailing.txt'), 'utf-8');
    expect(fileContent.endsWith('\n')).toBe(true);
  });

  it('should handle CRLF line endings', () => {
    const content = '<FILE path="crlf.txt">\r\n```\r\nCRLF content\r\n```\r\n</FILE>';

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(1);
    expect(fs.readFileSync(path.join(tmpDir, 'crlf.txt'), 'utf-8')).toContain('CRLF content');
  });

  it('should handle multiple FILE blocks with same content', () => {
    const content = `
<FILE path="dup1.js">
\`\`\`javascript
const x = 1;
\`\`\`
</FILE>
<FILE path="dup2.js">
\`\`\`javascript
const x = 2;
\`\`\`
</FILE>
`;

    const written = parseAndWriteFiles(content, tmpDir);
    expect(written).toHaveLength(2);
  });

  describe('multi-file block splitting', () => {
    it('should split a single FILE block containing //-style headers into separate files', () => {
      const content = `<FILE path="block.txt">
// frontend/package.json
{
  "name": "frontend"
}

// frontend/app/page.tsx
export default function Page() {
  return <div>Hello</div>;
}
</FILE>`;

      const written = parseAndWriteFiles(content, tmpDir);
      expect(written).toHaveLength(2);
      expect(written).toContain('frontend/package.json');
      expect(written).toContain('frontend/app/page.tsx');

      const pkg = fs.readFileSync(path.join(tmpDir, 'frontend', 'package.json'), 'utf-8');
      expect(pkg).toContain('"name": "frontend"');

      const page = fs.readFileSync(path.join(tmpDir, 'frontend', 'app', 'page.tsx'), 'utf-8');
      expect(page).toContain('Hello');
    });

    it('should split a single FILE block containing #-style headers', () => {
      const content = `<FILE path="block.md">
# README.md
# Project Title
Some description

# CHANGELOG.md
## v1.0.0
Initial release
</FILE>`;

      const written = parseAndWriteFiles(content, tmpDir);
      // Only the first two lines that look like file paths should be treated as headers
      // Lines like "# README.md" and "# CHANGELOG.md" have extensions -> are file headers
      expect(written).toHaveLength(2);
      expect(written).toContain('README.md');
      expect(written).toContain('CHANGELOG.md');
    });

    it('should NOT split when there is only one header', () => {
      const content = `<FILE path="single.txt">
// just_a_comment.js
const x = 1;
</FILE>`;

      const written = parseAndWriteFiles(content, tmpDir);
      // Single header should not trigger splitting — written as-is with the given path
      expect(written).toHaveLength(1);
      expect(written[0]).toBe('single.txt');
    });

    it('should handle code fences in multi-file blocks', () => {
      const content = `<FILE path="block.txt">
// frontend/app/page.tsx
\`\`\`tsx
export default function Page() {
  return <div>Hello</div>;
}
\`\`\`

// frontend/app/layout.tsx
\`\`\`tsx
export default function Layout({ children }) {
  return <html><body>{children}</body></html>;
}
\`\`\`
</FILE>`;

      const written = parseAndWriteFiles(content, tmpDir);
      expect(written).toHaveLength(2);

      const page = fs.readFileSync(path.join(tmpDir, 'frontend', 'app', 'page.tsx'), 'utf-8');
      expect(page).toContain('export default function Page()');
      expect(page).not.toContain('layout.tsx');

      const layout = fs.readFileSync(path.join(tmpDir, 'frontend', 'app', 'layout.tsx'), 'utf-8');
      expect(layout).toContain('export default function Layout');
    });

    it('should handle the exact format from the LLM output (8 frontend files in one block)', () => {
      const content = `<FILE path="relative/path">
// frontend/package.json
{
  "name": "frontend",
  "version": "1.0.0",
  "scripts": { "dev": "next dev" },
  "dependencies": { "next": "14.2.5", "react": "^18.2.0", "react-dom": "^18.2.0" }
}

// frontend/tsconfig.json
{
  "compilerOptions": { "target": "ES2017", "jsx": "preserve" }
}

// frontend/next.config.js
const nextConfig = { reactStrictMode: true };
module.exports = nextConfig;

// frontend/tailwind.config.js
module.exports = { content: ["./app/**/*.{js,ts,jsx,tsx}"] };

// frontend/postcss.config.js
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };

// frontend/app/globals.css
@tailwind base;
@tailwind components;
@tailwind utilities;
body { background: #0f172a; color: #e2e8f0; }

// frontend/app/layout.tsx
import "./globals.css";
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}

// frontend/app/page.tsx
'use client';
export default function Home() {
  return <h1>Hello from AEGIS!</h1>;
}
</FILE>`;

      const written = parseAndWriteFiles(content, tmpDir);
      expect(written).toHaveLength(8);

      // Verify a few key files
      expect(written).toContain('frontend/package.json');
      expect(written).toContain('frontend/app/page.tsx');
      expect(written).toContain('frontend/app/globals.css');
      expect(written).toContain('frontend/tailwind.config.js');

      // Verify content is correct
      const page = fs.readFileSync(path.join(tmpDir, 'frontend', 'app', 'page.tsx'), 'utf-8');
      expect(page).toContain('Hello from AEGIS!');
      expect(page).not.toContain('layout.tsx'); // no cross-contamination

      const globals = fs.readFileSync(path.join(tmpDir, 'frontend', 'app', 'globals.css'), 'utf-8');
      expect(globals).toContain('#0f172a');

      // Ensure relative/path was NOT written
      expect(written).not.toContain('relative/path');
    });

    it('should handle HTML-style comment headers (<!-- path -->)', () => {
      const content = `<FILE path="output.txt">
<!-- index.html -->
<!DOCTYPE html>
<html><head><title>Test</title></head><body>Hello</body></html>

<!-- style.css -->
body { background: #111; color: yellow; }
</FILE>`;

      const written = parseAndWriteFiles(content, tmpDir);
      expect(written).toHaveLength(2);
      expect(written).toContain('index.html');
      expect(written).toContain('style.css');

      const html = fs.readFileSync(path.join(tmpDir, 'index.html'), 'utf-8');
      expect(html).toContain('Hello');
    });
  });
});

describe('parseBattlePlan', () => {
  it('should parse a JSON battle plan from a code block', () => {
    const content = '```json\n{\n  "projectName": "test-project",\n  "phases": []\n}\n```';
    const plan = parseBattlePlan(content);
    expect(plan).not.toBeNull();
    expect(plan.projectName).toBe('test-project');
    expect(plan.phases).toEqual([]);
  });

  it('should parse a JSON battle plan without code fences', () => {
    const content = '{"projectName": "bare-project", "phases": []}';
    const plan = parseBattlePlan(content);
    expect(plan).not.toBeNull();
    expect(plan.projectName).toBe('bare-project');
  });

  it('should handle trailing commas gracefully', () => {
    const content = '{"projectName": "fix-project", "phases": [],}';
    const plan = parseBattlePlan(content);
    expect(plan).not.toBeNull();
    expect(plan.projectName).toBe('fix-project');
  });

  it('should return null for invalid JSON', () => {
    const content = 'Not JSON at all';
    const plan = parseBattlePlan(content);
    expect(plan).toBeNull();
  });

  it('should return null for empty content', () => {
    expect(parseBattlePlan('')).toBeNull();
  });

  it('should parse from a larger text with surrounding prose', () => {
    const content = `Here is the battle plan:
\`\`\`json
{
  "projectName": "prose-project",
  "objective": "Test",
  "phases": [
    { "phase": "backend", "agent": "backendEngineer", "deliverables": ["server.ts"] }
  ]
}
\`\`\`
Let me know if you have questions.`;

    const plan = parseBattlePlan(content);
    expect(plan).not.toBeNull();
    expect(plan.projectName).toBe('prose-project');
    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].agent).toBe('backendEngineer');
  });
});
