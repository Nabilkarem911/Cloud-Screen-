# Launch readiness changelog

## Unreleased (implementation batch)

### Added

- `Subscription.stripeCustomerId` / `stripeSubscriptionId` (unique) persisted from Checkout + subscription webhooks; `GET subscriptions/current` exposes `billingPortalAvailable`.
- `POST /api/v1/stripe/portal` — Stripe Customer Portal session (`STRIPE_PORTAL_RETURN_URL` or locale-aware default).
- `POST /api/v1/auth/register/resend` — throttled OTP resend for unverified accounts.
- Dashboard legal pages: `/[locale]/privacy`, `/[locale]/terms` (en/ar copy); links on login and register.
- Optional Sentry: backend (`SENTRY_DSN` + `SentryModule`), dashboard (`NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` + `withSentryConfig` + `instrumentation.ts`).
- Unit test: `stripe-webhook.service.spec.ts` (checkout metadata + duplicate `P2002`).
- Central `EmailService` with Resend, SendGrid, or SMTP transport; templates for registration OTP, password reset, email change, subscription reminders.
- Throttling on sensitive auth/account routes (`register/start`, `forgot-password`, `email/request`, `mock-plan`).
- `POST /api/v1/stripe/checkout` — Stripe Checkout Session for paid plans; metadata aligned with existing webhook handler.
- Webhook handling for `customer.subscription.updated` and `customer.subscription.deleted` to sync period end and status.
- `assertMockBillingAllowed()` — mock subscription endpoints disabled in production unless `ENABLE_MOCK_BILLING=true`.
- Documentation: `docs/runbook.md`, `docs/qa-checklist.md`, `docs/player-qa-checklist.md`, `docs/api-page-coverage-matrix.md`, `docs/strapi-marketing.md`, `docs/launch-checklist.md`.
- Optional `apps/marketing` Next.js placeholder for a public site.
- CI workflow: lint + build + Prisma validate + backend unit tests.

### Changed

- Billing UI: primary upgrade uses Stripe Checkout; demo plan toggles only when `NEXT_PUBLIC_ALLOW_MOCK_BILLING=true`.
- Admin overview / system health: explicit disclaimer for illustrative revenue figures.

### Configuration

See [.env.example](../.env.example) for new keys: email providers, Stripe price IDs, checkout URLs, `STRIPE_PORTAL_RETURN_URL`, Sentry DSNs, `NEXT_PUBLIC_ALLOW_MOCK_BILLING`, `ENABLE_MOCK_BILLING`.
