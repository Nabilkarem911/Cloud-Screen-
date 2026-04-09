<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## i18n Guardrails (Required)

- Do not ship hardcoded UI copy in components; always use translation keys.
- Add new keys to both `src/i18n/messages/en.json` and `src/i18n/messages/ar.json` with matching structure.
- For server pages under `app/[locale]/**`, call `getTranslations({ locale, namespace })` using route locale.
- For client components, prefer `useLocale()` for locale-aware logic; avoid locale fallbacks like `|| 'en'`.
- Dynamic backend labels (roles/statuses) must be mapped to `t(...)` keys before rendering.

### Pre-merge i18n checks

Run from repo root:

- `npm run i18n:check`
- `npm run -w apps/dashboard build`
