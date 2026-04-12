# Launch checklist (Definition of Done)

Use before tagging a production release.

## Functional

- [ ] Staging stack matches production: Postgres, Redis (if added), file storage for uploads, same env var names.
- [ ] `npm run build` succeeds for `apps/backend`, `apps/dashboard`, `apps/player`.
- [ ] `prisma migrate deploy` applied on production DB (see [docs/runbook.md](./runbook.md)).
- [ ] Dashboard: login, register+verify OTP, workspace create, screen create + pairing, media upload, playlist assign, schedule save.
- [ ] Player: pairing, playback, heartbeat, reconnect after network drop.
- [ ] Stripe: test Checkout → webhook updates workspace subscription (metadata `workspace_id`, `plan`).
- [ ] Email: registration OTP, password reset link, email-change OTP, subscription reminder (admin action) all received in inbox (sandbox).

## Security

- [ ] `JWT_*` secrets rotated; not default strings.
- [ ] `dev-login` and `mock-plan` / `subscription-mock` unreachable in production (or behind strict internal allowlist).
- [ ] `FRONTEND_ORIGINS` / `TRUST_DYNAMIC_CORS` aligned with real app URLs behind TLS.
- [ ] `STRIPE_WEBHOOK_SECRET` set; webhook URL uses HTTPS.

## Observability

- [ ] Optional: `SENTRY_DSN` (backend) and `NEXT_PUBLIC_SENTRY_DSN` (dashboard) set; errors appear in project.
- [ ] Healthchecks pass for API and dashboard containers (if using Docker).

## Legal / product (if public SaaS)

- [ ] Privacy policy + terms URLs reachable (marketing site or dashboard static pages).

## QA artifact

- [ ] [docs/qa-checklist.md](./qa-checklist.md) signed off for the release candidate.
