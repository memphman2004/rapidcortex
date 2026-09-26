# Google Analytics 4 — Property & page index

**Product:** NexCort iQ (formerly Rapid Cortex)  
**Updated:** 2026-09-25  
**Audience:** Marketing, growth, engineering  
**Status:** Operational index for GA4 configuration and reporting

This document is the canonical index of how Google Analytics is wired in the monorepo, which hosts it covers, which public pages should appear in reports, and recommended GA4 admin settings after the **nexcortiq.us** rebrand. Host cutover sequence: [NEXCORTIQ_CUTOVER.md](./NEXCORTIQ_CUTOVER.md).

---

## 1. Property snapshot

| Field | Value |
|---|---|
| **Platform** | Google Analytics 4 (gtag.js via Google Tag Manager loader) |
| **Measurement ID** | `G-S83NHMBHRD` |
| **Env override** | `NEXT_PUBLIC_GA_MEASUREMENT_ID` (if set, replaces default) |
| **Canonical marketing origin** | `https://www.nexcortiq.us` |
| **Former marketing origin** | `https://www.rapidcortex.us` (301 continuity; still allowlisted in splash gate) |
| **Ops / app origin** | `https://app.rapidcortex.us` (and stage hosts) |

### Code mount points

| App | File | Load strategy | Notes |
|---|---|---|---|
| **Marketing** | `apps/marketing/app/layout.tsx` | `lazyOnload` | Default ID `G-S83NHMBHRD` |
| **Web (app)** | `apps/web/app/layout.tsx` | `afterInteractive` | Same default ID; enabled whenever ID is non-empty |
| Shared helper (unused by layouts) | `apps/web/src/components/analytics/GoogleAnalytics.tsx` | — | Re-exported from `apps/web/components/analytics/`; layouts embed gtag inline today |

Snippet pattern (both apps):

```js
gtag('js', new Date());
gtag('config', 'G-S83NHMBHRD' /* or env */);
```

Marketing also loads the **Apollo website tracker** (`appId: 6a79214cacb3420018db7ea1`) in the same layout — keep GA and Apollo distinct in reporting.

---

## 2. Hostnames to configure in GA4

Configure these as **Data stream → Configure tag settings → Configure your domains** (and/or as internal traffic filters).

| Hostname | Role | Recommend in GA4 |
|---|---|---|
| `www.nexcortiq.us` | Primary marketing | **Include** (primary) |
| `nexcortiq.us` | Apex → www redirect | Include (or rely on www after redirect) |
| `www.rapidcortex.us` | Legacy marketing | Include for continuity traffic |
| `rapidcortex.us` | Legacy apex | Include for continuity |
| `app.rapidcortex.us` | Authenticated product | **Filter out or separate property** (see §6) |
| `app-staging.*` / localhost | Engineering | Exclude (developer traffic filter) |

**Cross-domain:** Marketing ↔ app sign-in hops should use GA4 cross-domain measurement **only if** you intentionally want a single user journey across public site and login. Prefer **not** stitching CJIS/ops sessions into marketing analytics.

---

## 3. Public page index (marketing sitemap)

Source of truth: `apps/marketing/app/sitemap.ts` (`PUBLIC_ROUTES` + published blog posts).  
Sitemap URL: `https://www.nexcortiq.us/sitemap.xml`  
Robots: `apps/marketing/app/robots.ts` → `sitemap: /sitemap.xml`

Use this list to build **GA4 Content groups** / comparisons (e.g. Product vs SEO landings vs Legal).

### 3.1 Core

| Path | Priority | Change freq |
|---|---:|---|
| `/` | 1.0 | weekly |
| `/rapid-cortex` | 0.85 | monthly |
| `/blog` | 0.8 | weekly |
| `/about` | 0.65 | monthly |
| `/careers` | 0.7 | weekly |
| `/pricing` | 0.9 | weekly |
| `/grants` | 0.9 | weekly |
| `/security` | 0.7 | monthly |
| `/trust` | 0.65 | monthly |
| `/press` | 0.5 | monthly |
| `/contact` | 0.5 | monthly |
| `/contact-sales` | 0.85 | weekly |
| `/request-demo` | 0.75 | weekly |
| `/demo` | 0.7 | weekly |
| `/free-60-day-pilot` | 0.75 | weekly |

### 3.2 Product

| Path | Priority | Change freq |
|---|---:|---|
| `/product` | 0.95 | weekly |
| `/product/core` | 0.95 | weekly |
| `/product/campus` | 0.9 | weekly |
| `/product/venue` | 0.9 | weekly |
| `/venue` | 0.9 | weekly |
| `/venue/how-it-works` | 0.7 | monthly |
| `/rc-lite` | 0.75 | weekly |
| `/desktop` | 0.55 | monthly |
| `/downloads` | 0.45 | monthly |

### 3.3 Solutions & integrations

| Path | Priority | Change freq |
|---|---:|---|
| `/solutions` | 0.8 | weekly |
| `/solutions/agencies` | 0.75 | weekly |
| `/solutions/vendors` | 0.75 | weekly |
| `/integrations` | 0.75 | weekly |
| `/cad` | 0.7 | weekly |
| `/cad-integration` | 0.7 | weekly |
| `/supervisor-dashboard` | 0.55 | monthly |
| `/connect/nest` | 0.7 | weekly |
| `/connect/wyze/start` | 0.7 | weekly |

### 3.4 SEO keyword landings

| Path | Priority | Change freq |
|---|---:|---|
| `/911-dispatch-software` | 0.7 | monthly |
| `/911-call-transcription` | 0.7 | monthly |
| `/ng911-software` | 0.7 | monthly |
| `/psap-software` | 0.7 | monthly |
| `/public-safety-intelligence` | 0.7 | monthly |
| `/campus-safety-software` | 0.85 | weekly |
| `/venue-safety-software` | 0.85 | weekly |
| `/stadium-security-software` | 0.8 | weekly |
| `/campus-safety-integrations` | 0.8 | weekly |
| `/venue-safety-integrations` | 0.8 | weekly |

### 3.5 Developers (public)

| Path | Priority | Change freq |
|---|---:|---|
| `/developers` | 0.7 | weekly |
| `/developers/docs` | 0.65 | weekly |
| `/developers/docs/errors` | 0.45 | monthly |
| `/developers/api` | 0.65 | weekly |
| `/developers/changelog` | 0.5 | weekly |
| `/developers/pricing` | 0.55 | monthly |
| `/developers/roi` | 0.5 | monthly |
| `/developers/status` | 0.45 | weekly |

### 3.6 Legal / compliance

| Path | Priority | Change freq |
|---|---:|---|
| `/legal/dpa` | 0.4 | monthly |
| `/legal/privacy` | 0.55 | monthly |
| `/legal/terms` | 0.55 | monthly |
| `/legal/account-deletion` | 0.5 | monthly |
| `/legal/sub-processors` | 0.5 | monthly |
| `/privacy` | 0.55 | monthly |
| `/terms` | 0.55 | monthly |
| `/account-deletion` | 0.5 | monthly |
| `/cookies` | 0.35 | monthly |
| `/acceptable-use` | 0.35 | monthly |
| `/sms-consent` | 0.4 | monthly |

### 3.7 Blog

Dynamic: `/blog/{slug}` for each published post from `getPublishedPosts()` (priority 0.6, monthly).

### 3.8 Intentionally **not** in sitemap (still may fire page_view if visited)

| Path / pattern | Reason |
|---|---|
| `/enter` | Splash / entry gate |
| `/login`, `/signup`, portals | Auth |
| `/app/*`, `/dashboard*`, `/rc-admin/*` | Product (disallowed in robots) |
| `/api/*` | APIs |
| Interactive developer sandboxes | Excluded from SEO index |

---

## 4. Recommended GA4 admin setup (checklist)

Use this when updating the GA4 property for the NexCort iQ rebrand:

1. **Property name:** `NexCort iQ — Marketing` (or keep historical name + note alias in property description).
2. **Data stream:** Web → primary URL `https://www.nexcortiq.us`.
3. **Enhanced measurement:** leave ON (scrolls, outbound clicks, site search if used).
4. **Referral exclusion list:** `nexcortiq.us`, `www.nexcortiq.us`, `rapidcortex.us`, `www.rapidcortex.us`, Cognito hosted UI host if auth redirects pollute acquisition.
5. **Unwanted referrals:** payment providers, if any checkout hops appear.
6. **Internal traffic:** define rule for office / VPN CIDRs; activate filter in **Test** then **Include**.
7. **Developer traffic:** exclude `localhost`, preview hosts, staging.
8. **Conversions (key events)** — create if not already:
   - `generate_lead` / form success on `/contact-sales`, `/request-demo`, `/free-60-day-pilot` (requires event instrumentation — see §5).
   - Outbound click to `app.rapidcortex.us/login` (optional).
9. **Content groups** (comparisons):
   - `Core`, `Product`, `SEO landings`, `Developers`, `Legal`, `Blog` (paths from §3).
10. **Annotations:** record 2026-09-24+ marketing rebrand / domain cutover date.
11. **Search Console link:** property for `www.nexcortiq.us` (+ domain property covering apex if used).
12. **BigQuery export:** optional; enable if SOC 2 evidence needs raw event retention beyond GA UI.

---

## 5. Events index (current vs recommended)

### 5.1 Currently automatic

| Event | Source | Notes |
|---|---|---|
| `page_view` | gtag `config` | Fires on marketing + web app layouts |
| Enhanced measurement events | GA4 defaults | scrolls, outbound, etc. (if enabled in Admin) |

No custom `gtag('event', …)` catalog is standardized in marketing layouts today beyond `config`.

### 5.2 Recommended custom events (implement next)

Instrument with `gtag('event', name, params)` on success paths only (no PII / no agency incident data):

| Event name | Where | Parameters (examples) |
|---|---|---|
| `generate_lead` | Contact sales / demo / pilot forms | `form_id`, `page_path` |
| `select_content` | Pricing CTA, product tabs | `content_type`, `item_id` |
| `file_download` | `/downloads`, desktop installers | `file_name` |
| `sign_up` | Public signup only (if any) | `method` |
| `login` | **Do not** send from authenticated ops console | — |

**Do not send:** incident IDs, CAD data, transcript text, badge numbers, phone numbers, emails in event params.

---

## 6. Compliance & CJIS-aware guidance

| Topic | Guidance |
|---|---|
| **Marketing site** | GA4 is appropriate for anonymous public traffic; disclose in cookie/privacy copy. |
| **Authenticated app (`app.*`)** | Prefer **disabling** GA on ops hosts or using a separate non-production stream. Today `apps/web/app/layout.tsx` loads the same measurement ID on the product app — treat as a follow-up harden item. |
| **PII** | Never put emails, names, or incident content in page titles, URLs, or event params that reach GA. |
| **Subprocessors** | Ensure Google Analytics appears on the public subprocessor / privacy pages when relied upon for marketing. |
| **Apollo tracker** | Marketing-only lead intelligence; not a substitute for GA reporting. |

### Suggested engineering follow-up

Gate web-app GA so it only loads on marketing hosts (or when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is explicitly set for a marketing deploy), e.g. skip when hostname starts with `app.`.

---

## 7. How to verify

1. Open `https://www.nexcortiq.us` in a private window.
2. Chrome DevTools → Network → filter `google-analytics.com` / `gtag/js?id=G-S83NHMBHRD`.
3. GA4 Admin → **DebugView** (with GA Debugger extension) → confirm `page_view`.
4. Realtime → confirm hostname `www.nexcortiq.us`.
5. After deploy of sitemap changes, confirm Coverage in Search Console separately (SEO ≠ GA).

### Env / deploy

```bash
# Optional override (marketing or web build)
export NEXT_PUBLIC_GA_MEASUREMENT_ID=G-S83NHMBHRD
```

Unset or empty on web: falls back to hardcoded default `G-S83NHMBHRD` (web layout). To fully disable web GA, code change is required (empty string still falls back today).

---

## 8. Related docs & code

| Resource | Path |
|---|---|
| Marketing layout (gtag) | `apps/marketing/app/layout.tsx` |
| Web layout (gtag) | `apps/web/app/layout.tsx` |
| Sitemap / public route index | `apps/marketing/app/sitemap.ts` |
| Human-readable site map | [SITE_MAP.md](./SITE_MAP.md) |
| Robots | `apps/marketing/app/robots.ts` |
| Site URL helpers | `apps/marketing/lib/seo.ts`, `apps/marketing/lib/site.ts` |
| SEO intelligence product notes | [CORTEX_SEO_INTELLIGENCE.md](./CORTEX_SEO_INTELLIGENCE.md) |
| Docs hub | [../INDEX.md](../INDEX.md) |

---

## 9. Change log

| Date | Change |
|---|---|
| 2026-09-25 | Initial GA4 index for NexCort iQ rebrand: measurement ID, hostnames, full public route table from sitemap, events recommendations, CJIS/app gating notes. |
