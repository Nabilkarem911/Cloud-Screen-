/**
 * Removes local build / cache folders to reduce disk use and stale Next/Nest output.
 * Safe: does not touch source, .env, or node_modules.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const dirs = [
  ['apps', 'dashboard', '.next'],
  ['apps', 'backend', 'dist'],
  ['apps', 'player', '.next'],
];

function rmDir(rel) {
  const target = path.join(root, ...rel);
  const baseOpts = { recursive: true, force: true };
  try {
    try {
      fs.rmSync(target, {
        ...baseOpts,
        maxRetries: 5,
        retryDelay: 200,
      });
    } catch (e) {
      // Older Node may not support maxRetries / retryDelay on fs.rmSync
      if (e && (e.code === 'ERR_INVALID_OPT_VALUE' || e.code === 'ERR_INVALID_ARG_VALUE')) {
        fs.rmSync(target, baseOpts);
      } else {
        throw e;
      }
    }
    console.log('removed:', path.relative(root, target));
  } catch (e) {
    if (e && e.code === 'ENOENT') return;
    console.warn(
      'skip (stop dev server if .next is locked):',
      path.relative(root, target),
      e && e.message,
    );
  }
}

for (const rel of dirs) {
  rmDir(rel);
}

console.log('clean-build: done');
