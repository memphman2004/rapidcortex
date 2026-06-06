# Auth device restrictions (mobile / tablet)

Operational Rapid Cortex login and authenticated app shells are intended for **approved desktop workstations**. Public marketing pages remain available on phones and tablets.

## Behavior

| Area | Phones | Tablets (default) |
|------|--------|-------------------|
| Public marketing (`/`, pricing, contact, etc.) | Allowed | Allowed |
| Login, Hosted UI starters, dashboards, dispatcher/supervisor/admin, jurisdictional consoles | Redirect to `/mobile-access-restricted` or `403` JSON on APIs | Same as phones unless configured otherwise |

Classification uses **HTTP `User-Agent`** in middleware and API handlers (no CSS-only enforcement).

## Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `DISABLE_MOBILE_AUTH` | **`true`-equivalent in production** when unset; **off** in non-production when unset | Master switch: when enforcing, mobile/tablet-class UAs cannot reach protected routes or most `/api/*` paths. |
| `NEXT_PUBLIC_DISABLE_MOBILE_AUTH` | (optional) | Public mirror used where server env is inlined; keep aligned with server for deployments that rely on client builds. |
| `BLOCK_TABLET_AUTH` | **`true`** when unset | When `false`, tablet-class user agents are **not** treated as mobile for blocking (phones still blocked). |

Examples in `apps/web/.env.example`.

## Audit logging

When a request is blocked, structured logs emit `eventType: "mobile_auth_blocked"` with route, timestamp, hashed user-agent fingerprint, coarse user-agent family, and optionally hashed correlation / IP metadata. **Tokens, authorization codes, and secrets are never logged.**

## Code map

- `apps/web/lib/device/isMobileRequest.ts` — UA detection and policy helpers.
- `apps/web/lib/device/middleware-mobile-auth.ts` — middleware response builder.
- `apps/web/lib/auth/guards/blockMobileAuth.ts` — reusable `403` guard for route handlers.
- `apps/web/middleware.ts` — runs mobile check before CSRF/session logic.
- `apps/web/app/mobile-access-restricted/page.tsx` — user-facing explanation.
