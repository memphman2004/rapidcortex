# GSC + GA4 automation (NexCort iQ)

Website: https://www.nexcortiq.us  
GCP project: `rapidcortex-prod`  
Service account: `nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com`  
AWS secret: `rapid-cortex/marketing/ga4-service-account` (account `158961537080`)  
Live measurement ID: **`G-NGT17QK1LW`** via **`GTM-M33PD9HM`**  
CLI: [GSC_GA4_CLI.md](./GSC_GA4_CLI.md)  
Dashboard: `/rc-admin/marketing/website` → Live Search Console & GA4 panel  
API: `GET /api/rc-admin/leads/marketing/seo-metrics`

## What was configured (read-only)

| Item | Status |
|---|---|
| APIs enabled on `rapidcortex-prod` (`searchconsole`, `analyticsadmin`, `analyticsdata`) | Done |
| Service account + local key `~/.config/gsc-ga4-cli/nexcortiq-gsc-ga4-sa.json` | Done |
| Secret stored in AWS Secrets Manager | Done |
| Cursor MCP `google-analytics-mcp` in `~/.cursor/mcp.json` | Done (restart Cursor to load) |
| Marketing Dashboard SEO metrics panel + BFF + Lambda handler | Done (code) |
| HttpApi routes + Secrets Manager IAM on Leads CRM | Done (templates — deploy to activate) |
| GSC / GA4 property ACL for the SA | **Blocked — manual grant required** |
| Duplicate GA4 property / web stream | **Not created** (by design) |
| Indexing API for product pages | **Not used** (unsupported for ordinary pages) |
| Mark lead events as GA4 key events | **Not applied** — needs explicit approval + Admin write scope |

## Manual authorization (required before data appears)

1. **Search Console** → property for `nexcortiq.us` (prefer `sc-domain:nexcortiq.us`) → Users → add  
   `nexcortiq-gsc-ga4@rapidcortex-prod.iam.gserviceaccount.com` (Full or Restricted).
2. **GA4** → existing property that owns stream **`G-NGT17QK1LW`** → Property access management → add the same SA as **Viewer**.
3. Optionally set numeric `ga4_property_id` on the Secrets Manager JSON after discovery (Admin → Property settings).
4. Confirm sitemap `https://www.nexcortiq.us/sitemap.xml` is listed; submit only if missing. Do **not** use the Indexing API for marketing pages.

After grants, verify locally:

```bash
export GSC_GA4_KEY="$HOME/.config/gsc-ga4-cli/nexcortiq-gsc-ga4-sa.json"
gsc sites list
ga4 summaries
```

## Cursor Analytics MCP

Official Google package via `uvx`:

```json
"google-analytics-mcp": {
  "command": "uvx",
  "args": ["--from", "analytics-mcp", "google-analytics-mcp"],
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "/Users/YOU/.config/gsc-ga4-cli/nexcortiq-gsc-ga4-sa.json",
    "GOOGLE_CLOUD_PROJECT": "rapidcortex-prod"
  }
}
```

Restart Cursor after editing `~/.cursor/mcp.json`. MCP is read-only; Admin mutations still need approval.

## Lead events (site → GA4)

Emit once per legitimate action (GTM or gtag). Do not double-count:

- `generate_lead`, `demo_request`, `pilot_application`, `quote_request`
- `calculator_completed`, `assessment_completed`, `newsletter_signup`

Marking these as **key events** via Admin API is deferred until you approve a write-scoped change. Tracking ID must remain `G-NGT17QK1LW`.

## Security

- Production credentials live in AWS Secrets Manager only.
- Local key stays under `~/.config/gsc-ga4-cli/` (never commit).
- Reporting uses read-only scopes; no destructive Google config without approval.
- Do not reuse `rapid-cortex/multilingual/google-service-account`.
