/**
 * Fails when explicit missing-translation markers appear in source files.
 * Markers are intentionally allowed as fallback, but must not be committed
 * as user-facing copy in messages/components.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'apps', 'dashboard', 'src');

const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);
const skipDirs = new Set(['node_modules', '.next', 'dist', 'coverage']);
const skipFiles = new Set([
  path.join(srcRoot, 'i18n', 'fallback.ts'),
]);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (textExts.has(path.extname(entry.name))) out.push(full);
  }
}

function lineNum(content, idx) {
  return content.slice(0, idx).split('\n').length;
}

const files = [];
walk(srcRoot, files);

const hits = [];
for (const file of files) {
  if (skipFiles.has(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const regex = /\[missing:[^\]]+\]/g;
  let m;
  while ((m = regex.exec(content)) != null) {
    hits.push({
      file: path.relative(root, file),
      line: lineNum(content, m.index),
      marker: m[0],
    });
  }
}

if (hits.length === 0) {
  console.log('i18n:missing-marker-scan: OK');
  process.exit(0);
}

console.error(`i18n:missing-marker-scan: found ${hits.length} marker(s)`);
for (const hit of hits.slice(0, 200)) {
  console.error(`- ${hit.file}:${hit.line} ${hit.marker}`);
}
if (hits.length > 200) {
  console.error(`... and ${hits.length - 200} more`);
}
process.exit(1);
