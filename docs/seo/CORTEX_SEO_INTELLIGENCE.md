# Cortex SEO Intelligence

Internal admin tooling for Rapid Cortex / Apps on Demand to analyze public marketing pages, score SEO hygiene, surface actionable issues, generate metadata and JSON-LD snippets, and compare outlines — **without exposing private URLs or raw infrastructure**.

## Overview

- **Audience**: Agency `admin`, `it_admin`, and `rc_admin` (same gate as other `/admin` APIs via `AuthorizationService.canAccessAdminRoutes`).
- **UI route**: `/admin/seo` (behind `NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE`).
- **API prefix**: `/api/admin/seo/*` — deployed by `SeoIntelligenceHttpFunction` in `infra/nested/stack-app-sam.yaml`.
- **Persistence**: DynamoDB table `SeoIntelligenceTable` — partition key `agencyId`, sort key `sk` (`SCAN#…`, `ISSUE#…`).

## Features

1. **SEO Page Scanner** — Fetches a URL (HTML only), extracts title, meta description, H1–H3, canonical, Open Graph, Twitter cards, image alt coverage, internal/external links (sampled), checks HTTP status, robots/noindex signals, sitemap presence for the final URL, JSON-LD types, word count, keyword-density signals, and duplicate title/meta vs recent scans for the same tenant.
2. **SEO Score (0–100)** — Category scores: metadata, headings, content quality, technical SEO, links, images, schema, performance readiness; weighted overall score with critical issues, recommendations, and quick wins.
3. **Keyword Intelligence** — Placement + density vs URL/title/meta/headings/body plus heuristic suggestion bullets.
4. **SEO Intelligence Suggestions** — Uses Bedrock when `SEO_AI_SUGGESTIONS_ENABLED=true` and `QA_BEDROCK_MODEL_ID` is set; otherwise deterministic templates. **UI never names a vendor/model** — copy refers to “SEO Intelligence Suggestions”.
5. **Sitemap / robots check** — Fetches `/sitemap.xml` and `/robots.txt` for an allowed origin and summarizes counts plus snippets (public hosts only).
6. **Schema generator** — JSON-LD builders for Organization, SoftwareApplication, Product, FAQPage, LocalBusiness, Article, BreadcrumbList.
7. **Comparison page helper** — Structured outlines for predefined positioning topics (CAD legacy, NG911 media-only, RC Lite API, emergency intelligence, dispatcher decision-support).
8. **Issue tracker** — Persisted `SEOIssue` rows with severity and workflow status (`OPEN` | `FIXED` | `IGNORED`).
9. **Automation flags** — `SEO_AUTO_SCAN_ENABLED` gates non-manual schedules at the API (EventBridge wiring reserved).

## Environment variables

### Lambda / API

| Variable | Purpose |
| -------- | ------- |
| `SEO_INTELLIGENCE_TABLE` | DynamoDB table name for scans/issues (required for writes). |
| `SEO_TOOL_ENABLED` | `"false"` disables HTTP responses (503) except routing remains deployed. |
| `SEO_AUTO_SCAN_ENABLED` | `"true"` allows `daily` / `weekly` scan schedules in POST `/scans`; default manual-only. |
| `SEO_AI_SUGGESTIONS_ENABLED` | `"false"` forces rule-based SEO Intelligence Suggestions (no Bedrock). |
| `SEO_MAX_FETCH_BYTES` | Optional — hard cap on downloaded HTML (default ~2MB). |
| `SEO_FETCH_TIMEOUT_MS` | Optional — fetch timeout (default 15s). |
| `SEO_MAX_BROKEN_LINK_CHECKS` | Optional — max URLs checked with HEAD/GET fallback (default 40). |
| `QA_BEDROCK_MODEL_ID` | Bedrock model id when AI suggestions are enabled (shared with QA scoring stack wiring). |
| `SEO_ALLOW_PRIVATE_URL_SCAN` | **Non-production only** — skips DNS private-range enforcement when set to `"true"`. |

### Web (`apps/web`)

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_ENABLE_SEO_INTELLIGENCE` | `"1"` shows the `/admin/seo` nav tab and page. |

## Admin usage

1. Enable the UI flag and deploy API routes + table.
2. Open **Admin → SEO Intel**, enter a **public https URL** on your marketing origin, run **Scan a Page**.
3. Review **overview**, **recent scans**, **issues**, and export JSON from planner / suggestions / schema tools as needed.
4. Patch issue status via API (`PATCH /api/admin/seo/issues/{id}`) or the on-page buttons.

## Security protections

- **RBAC**: Admin-route roles only (`admin`, `it_admin`, `rc_admin`).
- **Tenant isolation**: Every DynamoDB access uses `agencyId` from JWT claims.
- **SSRF**: Blocks non-http(s) URLs, credentials in URLs, `.internal` / `.local`, IPv4 private ranges, IPv6 ULA/link-local/loopback, and AWS metadata targets; DNS `lookup` validates hostnames before fetch (unless `SEO_ALLOW_PRIVATE_URL_SCAN=true`).
- **Size/time limits**: Response bodies truncated to configured bytes; per-link checks capped.
- **Sanitization**: HTML parsed with Cheerio only (no execution); logs avoid raw page body.
- **Audit**: `seo.intelligence.scan_run` and `seo.intelligence.issue_updated` events via `AUDIT_EVENT_TYPES`.
- **Suggestion UX**: Product UI labels **SEO Intelligence Suggestions**, not provider names.

## SSRF prevention (implementation summary)

1. Parse URL — reject unsupported schemes and embedded credentials.
2. Reject literal dangerous IPs and problematic host suffixes.
3. Resolve hostname → reject if **any** A/AAAA record maps to a blocked range.
4. Fetch with streaming byte cap + abort timeout.

## SEO scoring logic (high level)

- **Metadata**: Title/meta length bands, OG richness.
- **Headings**: Prefer single H1; reward H2/H3 structure.
- **Content quality**: Word-count thresholds.
- **Technical SEO**: HTTP success, canonical, indexability (robots + `X-Robots-Tag`), viewport/meta hygiene.
- **Links**: Penalize broken links (sampled).
- **Images**: Penalize missing alt relative to total images.
- **Schema**: Reward JSON-LD detection.
- **Performance readiness**: Placeholder-oriented composite (viewport + charset signals).

Overall score is a weighted blend of the eight categories (see `apps/api/src/services/seo/seoScore.ts`).

## Tests

Vitest coverage includes HTML extraction, scoring sanity, SSRF literals, finding generation, JSON-LD shape, RBAC on the HTTP handler, runtime UI flag parsing, and feature-flag HTTP behavior.

## Future roadmap

- Scheduled re-scans via EventBridge (`SEO_AUTO_SCAN_ENABLED`) with idempotent dedupe.
- Full-site crawl budgets and GSC integration (read-only).
- Lighthouse/PageSpeed and mobile UX signals where permitted by CSP and runtime budgets.
- Cross-agency RC Admin reporting for marketing domains (still tenant-scoped writes).
