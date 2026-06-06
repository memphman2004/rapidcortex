# Rapid Cortex marketing (static export)

Separate Next.js app for apex/www (`rapidcortex.us`, `www.rapidcortex.us`) on S3 + CloudFront.

- **Build:** `npm run build` → `out/`
- **Deploy:** `npm run sync:marketing` from repo root (or `scripts/sync-web-static-to-s3.sh` with `STATIC_DIR=apps/marketing/out`)
- **Shared UI/lib:** imports resolve to `apps/web` via `@/*` alias (see `next.config.mjs`). Long-term: extract shared pieces to `packages/ui`.

## Env

Use the same `NEXT_PUBLIC_*` values as SSR marketing builds (`scripts/env-web-ssr-prod.sh`).

```bash
source scripts/env-web-ssr-prod.sh
export NEXT_PUBLIC_SITE_URL=https://www.rapidcortex.us
cd apps/marketing && npm run build
```

## Routes

Pages live under `app/(marketing)/` (route group — not in the URL). Migrated from `apps/web/app/(marketing)/`.
