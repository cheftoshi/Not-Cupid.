import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), '.next', 'static', 'chunks');
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.js')) files.push({ path, bytes: statSync(path).size });
  }
}
walk(root);
const total = files.reduce((sum, file) => sum + file.bytes, 0);
const largest = files.reduce((max, file) => Math.max(max, file.bytes), 0);
const maxChunk = 750 * 1024;
const maxTotal = 6 * 1024 * 1024;
if (largest > maxChunk || total > maxTotal) {
  console.error(JSON.stringify({ ok: false, largest, total, maxChunk, maxTotal }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, chunks: files.length, largest, total, maxChunk, maxTotal }));
