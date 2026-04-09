/**
 * Syncs root `.env` into `apps/backend/.env` so Prisma CLI and NestJS load DATABASE_URL reliably.
 * Run from repo root: `node scripts/sync-env.cjs`
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rootEnv = path.join(root, '.env');
const exampleEnv = path.join(root, '.env.example');
const backendEnv = path.join(root, 'apps', 'backend', '.env');

function ensureRootEnv() {
  if (fs.existsSync(rootEnv)) return;
  if (!fs.existsSync(exampleEnv)) {
    console.error('sync-env: Missing .env and .env.example at repo root.');
    process.exit(1);
  }
  fs.copyFileSync(exampleEnv, rootEnv);
  console.log('sync-env: Created .env from .env.example');
}

function sync() {
  ensureRootEnv();
  fs.mkdirSync(path.dirname(backendEnv), { recursive: true });
  fs.copyFileSync(rootEnv, backendEnv);
  console.log('sync-env: Copied .env → apps/backend/.env');
}

sync();
