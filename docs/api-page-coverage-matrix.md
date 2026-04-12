# API ↔ UI coverage matrix (CloudSignage)

**Purpose:** Track which backend routes are exercised by the dashboard or player, and UX maturity (loading / error / empty). Priorities: **P0** launch blocker, **P1** should fix before GA, **P2** polish.

**Legend:** ✓ wired | ~ partial | — not used from UI | UX: L/E/D = loading / error / empty states reviewed

| Area | API (prefix `/api/v1`) | Dashboard / Player | Priority | UX notes |
|------|------------------------|--------------------|----------|----------|
| Auth | `POST auth/register/start`, `verify`, `resend` | `register-client` | P0 | L/E on submit; resend throttled |
| Auth | `POST auth/login`, `refresh`, `logout`, `GET me` | `login-form`, session | P0 | Cookie + CSRF |
| Auth | `POST forgot-password`, `reset-password` | forgot-password pages | P0 | Email provider required in prod |
| Auth | `POST dev-login` | dev only | P0 | Must be disabled in production |
| Account | `PATCH profile`, `POST email/*` | settings profile | P0 | |
| Account | `GET billing`, `GET insights` | billing / admin | P1 | |
| Workspaces | CRUD, invites, seed, pairing | branches, workspace switcher | P0 | Pairing v2 E2E |
| Screens | CRUD, override, remote-command | screens, branch detail | P0 | |
| Media | upload, list, folders | media library | P0 | Large upload feedback |
| Playlists | CRUD, items, duplicate, clone | playlists, branch | P0 | |
| Canvases | CRUD | studio | P0 | Save errors |
| Schedules | CRUD, overlaps | schedules | P1 | |
| Subscriptions | `GET current`, `PATCH mock-plan` | billing | P0 | mock-plan prod off |
| Stripe (billing) | `POST stripe/checkout`, `POST stripe/portal` | billing (`/billing`, `/settings/billing`) | P0 | JWT + OWNER/ADMIN; portal when `stripeCustomerId` set |
| Legal (static) | — | `/[locale]/privacy`, `/[locale]/terms` | P1 | Linked from login/register |
| Player | bootstrap, pairing | `apps/player` | P0 | |
| Admin | users, customers, fleet, stats, logs, settings | admin/* | P1 | Revenue KPIs may be illustrative until payments wired |
| Webhooks | `POST webhooks/stripe` | Stripe only | P0 | Raw body + signature |
| Realtime | Socket.IO | dashboard + player | P0 | Same-origin / CORS |

## Player (`apps/player`)

| Concern | Source | Priority |
|---------|--------|----------|
| Bootstrap + playlist | `GET player/bootstrap` | P0 |
| Pairing | `POST player/pairing/sessions`, `GET .../:id` | P0 |
| Canvas | `GET player/canvas/:id` | P1 |
| Offline / WS drop | client | P1 |

_Update this file when adding routes or pages._
