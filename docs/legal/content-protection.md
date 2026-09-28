# Content protection (sales / enablement)

Client deterrents + forensic watermarking for competitive surfaces.
**Not applied to live dispatch** (operators must copy notes/phones).

## What shipped

| Layer | Location |
|-------|----------|
| robots.txt (AI + SEO bots) | `apps/marketing/public/robots.txt`, `apps/web/public/robots.txt` |
| security.txt | `apps/*/public/.well-known/security.txt` |
| Edge AI-bot 403 | `apps/web/middleware.ts` (training crawlers only — not curl/wget) |
| `X-Robots-Tag: noai` | `apps/web/next.config.mjs` headers |
| ProtectedPage + Demo Mode | `apps/web/components/content-protection/` |
| Sales portal wiring | `SalesPortalShell` |
| Violation / demo APIs | `/api/security/log-violation`, `/api/security/demo-mode` |
| Legal templates | `docs/legal/` (attorney review before send) |

## Demo mode (screen share for demos/training)

1. Open Sales Portal → **Start Demo** → Confirm (2 hours).
2. Screen share and Alt-Tab work; copy/print still blocked.
3. Gold watermark marks screenshots with email + date.
4. Auto-expires or click **Stop**.

## Env

```bash
# Default ON when unset
NEXT_PUBLIC_ENABLE_CONTENT_PROTECTION=1

# Optional DynamoDB table for durable evidence (soft-fails to CloudWatch logs if unset)
VIOLATION_LOG_TABLE=rapid-cortex-content-violations-dev
```

## Honesty note

Browser protections are **deterrents + forensic watermarks**, not cryptographic DRM.
Determined actors can still photograph screens or use OS-level capture. Pair with
legal templates, Google Alerts, and prior-art documentation.
