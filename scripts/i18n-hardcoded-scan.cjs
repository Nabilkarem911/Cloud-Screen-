/**
 * Detects likely hardcoded UI copy in React source.
 * This is intentionally conservative and focuses on common regressions.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'apps', 'dashboard', 'src');
const exts = new Set(['.tsx', '.jsx']);

const allowExact = new Set([
  'https://',
  'http://',
  'W',
  'H',
]);

const skipDirs = new Set([
  'node_modules',
  '.next',
  'dist',
  'coverage',
]);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (exts.has(path.extname(entry.name))) out.push(full);
  }
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function addMatch(matches, file, index, text, reason) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return;
  if (allowExact.has(cleaned)) return;
  matches.push({
    file: path.relative(root, file),
    line: lineNumberAt(fs.readFileSync(file, 'utf8'), index),
    text: cleaned,
    reason,
  });
}

function scanFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = [];
  const lines = content.split('\n');

  // JSX text nodes on a single line: >Some Text<
  let cursor = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('=>')) continue;
    if (line.includes('Promise<')) continue;
    const jsxText = />\s*([^<>{}]{1,120}?)\s*</g;
    let m;
    while ((m = jsxText.exec(line)) != null) {
      const text = m[1];
      if (!/[A-Za-z]/.test(text)) continue;
      if (/[=()]/.test(text)) continue;
      if (/^(className|onClick|type|role|aria-hidden)\b/.test(text.trim())) continue;
      const absoluteIndex = cursor + m.index;
      addMatch(matches, file, absoluteIndex, text, 'jsx-text');
    }
    cursor += line.length + 1;
  }

  // Common attributes with static strings.
  let m;
  const attrs = /(placeholder|title|aria-label)=["']([A-Za-z][^"']{0,140})["']/g;
  while ((m = attrs.exec(content)) != null) {
    addMatch(matches, file, m.index, m[2], 'static-attribute');
  }

  // Toast messages with static EN strings.
  const toasts = /toast\.(error|success|info)\(\s*['"]([A-Za-z][^'"]{0,160})['"]\s*\)/g;
  while ((m = toasts.exec(content)) != null) {
    addMatch(matches, file, m.index, m[2], 'toast-literal');
  }

  // Filter known false positives.
  return matches.filter((x) => {
    if (x.text.includes('Promise<void>')) return false;
    if (x.text.includes('application/')) return false;
    if (/^[A-Z0-9_]{2,}$/.test(x.text)) return false;
    return true;
  });
}

const files = [];
walk(srcRoot, files);

const all = [];
for (const file of files) {
  const matches = scanFile(file);
  all.push(...matches);
}

if (all.length === 0) {
  console.log('i18n:hardcoded-scan: OK');
  process.exit(0);
}

console.error(`i18n:hardcoded-scan: found ${all.length} potential issues`);
for (const hit of all.slice(0, 200)) {
  console.error(`- ${hit.file}:${hit.line} [${hit.reason}] "${hit.text}"`);
}
if (all.length > 200) {
  console.error(`... and ${all.length - 200} more`);
}
process.exit(1);
