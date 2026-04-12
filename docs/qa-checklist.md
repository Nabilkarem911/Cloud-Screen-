# QA checklist (release candidate)

Run against a **staging** environment that mirrors production configuration.

## Auth & account

- [ ] Register new user → receive OTP email (or dev log in non-prod) → verify → workspace created.
- [ ] Login with verified user; cookies set; refresh works.
- [ ] Forgot password → email contains working link to `/{locale}/forgot-password?email=&token=` → reset succeeds.
- [ ] Profile update; email change request → OTP to new address → verify.

## Workspace & content

- [ ] Create workspace; switch workspace; invite flow if used.
- [ ] Upload media (small + large file); delete; folder create/move.
- [ ] Create playlist; drag items; publish; assign to screen.
- [ ] Schedule create/edit; overlap warning if applicable.
- [ ] Studio: save canvas; reload preserves layout.

## Screens & player

- [ ] Pairing v2: start session on player; claim from dashboard; screen appears online.
- [ ] Player plays assigned playlist; heartbeat updates admin/fleet views.
- [ ] See [player-qa-checklist.md](./player-qa-checklist.md).

## Billing

- [ ] `GET /subscriptions/current` matches UI.
- [ ] Stripe Checkout opens when `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID_PRO` set; successful payment updates plan (webhook).
- [ ] Mock plan buttons **hidden** in production unless `NEXT_PUBLIC_ALLOW_MOCK_BILLING=true` and server allows mock billing.

## Admin

- [ ] Super admin can open overview, customers, fleet; revenue disclaimer visible where applicable.
- [ ] Subscription reminder action sends email when provider configured.

## Security

- [ ] `dev-login` returns 404 in production without `ENABLE_DEV_LOGIN=true`.
- [ ] CSRF enforced on browser cookie auth POSTs; login/register exempt.

## i18n

- [ ] `npm run i18n:check` passes; smoke test Arabic + English on shell + auth.
