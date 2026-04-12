# Player manual QA checklist

Test the web player (`apps/player`, default port **3001** in dev).

## Environment

- [ ] `NEXT_PUBLIC_API_BASE_URL` points to running API.
- [ ] `NEXT_PUBLIC_REALTIME_URL` matches Socket.IO origin (usually same host as API).
- [ ] Pairing: either kiosk serial/secret envs **or** v2 pairing with empty serial as documented in `.env.example`.

## Bootstrap & playback

- [ ] Cold load: player reaches bootstrap endpoint and renders without white screen.
- [ ] Playlist advances through items; duration respected for images/video/canvas.
- [ ] Missing media: player shows recoverable error or skip (no infinite spinner).

## Network resilience

- [ ] Disable Wi‑Fi mid-playback: overlay / offline behaviour; re-enable: reconnect and resume or reload cleanly.
- [ ] WebSocket disconnect: client reconnects; screen heartbeat resumes.

## Pairing v2

- [ ] Six-digit code appears; poll secret not exposed in UI.
- [ ] After dashboard claim: player receives workspace assignment and continues to bootstrap.
- [ ] Expired session: clear message; user can refresh to start new session.

## Layout

- [ ] 1920×1080 viewport: canvas/media `cover` or `contain` per `NEXT_PUBLIC_PLAYER_MEDIA_OBJECT_FIT`.
- [ ] Smaller window: no clipped critical controls; ticker/HUD readable (RTL if used).

## Sign-off

Tester name / date: _________________  
Build / commit: _________________
