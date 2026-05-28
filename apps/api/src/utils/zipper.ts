import archiver from 'archiver';
import fs from 'fs';

export async function zipDirectory(sourceDir: string, outPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(outPath));
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
