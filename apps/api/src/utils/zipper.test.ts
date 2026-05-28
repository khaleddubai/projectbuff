import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { zipDirectory } from './zipper';

describe('zipDirectory', () => {
  let tmpDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-zip-src-'));
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-zip-out-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('should create a zip file from a directory', async () => {
    // Create a test file in the source directory
    fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'Hello from zip test', 'utf-8');

    const zipPath = path.join(outputDir, 'test.zip');
    const result = await zipDirectory(tmpDir, zipPath);

    expect(result).toBe(zipPath);
    expect(fs.existsSync(zipPath)).toBe(true);

    // Zip file should be larger than 0 bytes
    const stats = fs.statSync(zipPath);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should zip nested directories', async () => {
    // Create nested structure
    fs.mkdirSync(path.join(tmpDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'root.txt'), 'Root file', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'nested', 'child.txt'), 'Child file', 'utf-8');

    const zipPath = path.join(outputDir, 'nested.zip');
    const result = await zipDirectory(tmpDir, zipPath);

    expect(result).toBe(zipPath);
    expect(fs.existsSync(zipPath)).toBe(true);
  });

  it('should handle empty directories', async () => {
    const zipPath = path.join(outputDir, 'empty.zip');
    const result = await zipDirectory(tmpDir, zipPath);

    expect(result).toBe(zipPath);
    expect(fs.existsSync(zipPath)).toBe(true);
  });

  it('should create a zip with multiple files', async () => {
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(tmpDir, `file-${i}.txt`), `Content ${i}`, 'utf-8');
    }

    const zipPath = path.join(outputDir, 'multi.zip');
    const result = await zipDirectory(tmpDir, zipPath);

    expect(result).toBe(zipPath);
    const stats = fs.statSync(zipPath);
    // Should be larger than single file zip
    expect(stats.size).toBeGreaterThan(100);
  });

  it('should resolve with the output path', async () => {
    fs.writeFileSync(path.join(tmpDir, 'resolve-test.txt'), 'test', 'utf-8');

    const zipPath = path.join(outputDir, 'resolve.zip');
    const result = await zipDirectory(tmpDir, zipPath);

    expect(result).toBe(zipPath);
  });
});
