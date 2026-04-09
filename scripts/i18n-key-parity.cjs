/**
 * Ensures `en.json` and `ar.json` have the same nested key structure.
 * Fails with non-zero exit code when keys are missing on either side.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const messagesDir = path.join(root, 'apps', 'dashboard', 'src', 'i18n', 'messages');
const enPath = path.join(messagesDir, 'en.json');
const arPath = path.join(messagesDir, 'ar.json');

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('i18n:key-parity: failed to parse JSON:', filePath);
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  }
}

function isObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function walk(base, other, prefix, missing) {
  for (const key of Object.keys(base)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (!(key in other)) {
      missing.push(full);
      continue;
    }
    if (isObject(base[key]) && isObject(other[key])) {
      walk(base[key], other[key], full, missing);
    }
  }
}

const en = loadJson(enPath);
const ar = loadJson(arPath);

const missingInAr = [];
const extraInAr = [];
walk(en, ar, '', missingInAr);
walk(ar, en, '', extraInAr);

if (missingInAr.length === 0 && extraInAr.length === 0) {
  console.log('i18n:key-parity: OK');
  process.exit(0);
}

if (missingInAr.length > 0) {
  console.error(`i18n:key-parity: missing in ar.json (${missingInAr.length})`);
  for (const k of missingInAr) console.error('  -', k);
}
if (extraInAr.length > 0) {
  console.error(`i18n:key-parity: extra in ar.json (${extraInAr.length})`);
  for (const k of extraInAr) console.error('  -', k);
}

process.exit(1);
