# Cloud Signage

Monorepo for the Cloud Signage platform: dashboard (Next.js), API (NestJS + Prisma + PostgreSQL), and Electron/web player.

## Requirements

- Node.js 20+
- PostgreSQL 16+ (local or Docker)
- npm workspaces (run commands from the repository root unless noted)

## Quick start

1. Copy `.env.example` to `.env` at the repo root and adjust secrets (`DATABASE_URL`, JWT secrets, etc.).
2. Install dependencies: `npm install`
3. Apply database schema: `npm run prisma:migrate -w apps/backend` (or `prisma migrate deploy` in production).
4. Optional seed: `npm run prisma:seed -w apps/backend`
5. Development (dashboard + backend + player): `npm run dev`

API base URL defaults to `http://localhost:4000/api/v1`; dashboard reads `NEXT_PUBLIC_API_BASE_URL`.

## Workspace scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Dashboard (3000), backend (4000), player via Concurrently |
| `npm run build` | Production build for dashboard, backend, and player |
| `npm run lint` | ESLint in each app |
| `npm run i18n:check` | Parity and hardcoded-string scans for `en` / `ar` messages |

## Documentation

- [Runbook](docs/runbook.md), [QA checklist](docs/qa-checklist.md), [Launch checklist](docs/launch-checklist.md)
- [API ↔ UI coverage matrix](docs/api-page-coverage-matrix.md)
- [Launch changelog](docs/CHANGELOG_LAUNCH.md)

## Optional integrations

- **Email:** Resend, SendGrid, or SMTP — see `.env.example`
- **Stripe:** Checkout, webhooks, Customer Portal — price IDs and `STRIPE_WEBHOOK_SECRET` in `.env.example`
- **Sentry:** `SENTRY_DSN` (backend), `NEXT_PUBLIC_SENTRY_DSN` or `SENTRY_DSN` (dashboard) when wired in config

## Docker / Railway (backend API)

- **Build context** must be the **monorepo root** (same as `docker compose`), not `apps/backend`:
  - `docker build -f Dockerfile.backend .`
- On **Railway**, set the service **Root Directory** to the repo root (or leave default if the whole repo is the service), and point the Dockerfile to `Dockerfile.backend`.
- The image runs `npm ci` at the root, then `npm run prisma:generate -w apps/backend` (requires `DATABASE_URL` only for schema resolution; a dummy URL is set in the Dockerfile build stage) before `npm run build -w apps/backend`.
- Internal workspace packages live under `packages/` (`packages/*` in `package.json`); add libraries there and reference them from apps with your npm workspace protocol so `npm ci` links them during the build.

## GitHub: sync & CI

- **Day to day:** `git pull --rebase origin main` before you start, then after changes: `git status` → `git add` / `git commit` → `git push origin main`.
- **Do not commit** real `.env` files, `apps/backend/.data/`, or `.next` / `dist` output (see `.gitignore`).
- **CI** (`.github/workflows/ci.yml`) runs on push/PR to `main`, `master`, or `develop`: install, `prisma generate` + `prisma validate` (uses a dummy `DATABASE_URL` — no database container needed), backend build/tests, dashboard/player/marketing builds, and i18n checks.
