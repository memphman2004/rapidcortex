# NexCort iQ marketing site map

**Updated:** 2026-09-25  
**Canonical host:** `https://www.nexcortiq.us`  
**Machine sitemap:** `https://www.nexcortiq.us/sitemap.xml`  
**Source:** `apps/marketing/app/` pages vs `apps/marketing/app/sitemap.ts`

This is the human-readable map of **current** marketing App Router pages. It distinguishes SEO-indexed URLs (emitted in `sitemap.xml`) from live routes that exist but are intentionally excluded (auth, portals, sandboxes).

Former host `www.rapidcortex.us` should 301 to the same paths on `www.nexcortiq.us`. Phased cutover (app stays on Rapid Cortex): [NEXCORTIQ_CUTOVER.md](./NEXCORTIQ_CUTOVER.md).

---

## How to read this map

| Column | Meaning |
|---|---|
| **Path** | URL path on the marketing site |
| **In sitemap.xml?** | Listed in `PUBLIC_ROUTES` (or blog generator) |
| **Priority** | Sitemap priority hint (1.0 = strongest) |

Dynamic segments are noted as `{param}`.

---

## A. SEO-indexed public pages (`sitemap.xml`)

These are the pages Google (and GA content groups) should treat as the public site index.

### A1. Core

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
| `/status` | 0.45 | weekly |

### A2. Product

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

### A3. Solutions & integrations

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

### A4. SEO keyword landings

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

### A5. Developers (public docs)

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

### A6. Legal & compliance

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

### A7. Blog (dynamic)

| Path | Priority | Change freq |
|---|---:|---|
| `/blog/{slug}` | 0.6 | monthly |

Generated from published posts in the blog catalog (`getPublishedPosts()`). Also available: `/blog/rss.xml` (feed; not listed as an HTML sitemap entry).

---

## B. Live pages **excluded** from `sitemap.xml`

These routes exist in the App Router but are omitted from the public SEO sitemap (auth, portals, gates, or interactive tools).

### B1. Entry / auth / account

| Path | Why excluded |
|---|---|
| `/enter` | Splash / entry gate (`robots` disallow) |
| `/login` | Auth |
| `/signup` | Auth |
| `/unsubscribe` | Email preference utility |

### B2. RC Lite customer portal (authenticated)

| Path | Why excluded |
|---|---|
| `/rc-lite/portal` | Signed-in portal |
| `/rc-lite/portal/api-clients` | Portal |
| `/rc-lite/portal/audit-logs` | Portal |
| `/rc-lite/portal/billing` | Portal |
| `/rc-lite/portal/docs` | Portal |
| `/rc-lite/portal/usage` | Portal |
| `/rc-lite/portal/webhooks` | Portal |

### B3. Developer interactive tools

| Path | Why excluded |
|---|---|
| `/developers/playground` | Interactive sandbox |
| `/developers/sandbox` | Interactive sandbox |
| `/developers/simulation` | Interactive tool |
| `/developers/webhooks-test` | Interactive tool |
| `/developers/docs/{...slug}` | Catch-all docs tree (index `/developers/docs` is in sitemap) |

---

## C. Flat checklist (all marketing `page.tsx` routes)

Copy/paste inventory of every `page.tsx` under `apps/marketing/app` (sorted).

**Indexed**
- `/`
- `/911-call-transcription`
- `/911-dispatch-software`
- `/about`
- `/acceptable-use`
- `/account-deletion`
- `/blog`
- `/cad`
- `/cad-integration`
- `/campus-safety-integrations`
- `/campus-safety-software`
- `/careers`
- `/connect/nest`
- `/connect/wyze/start`
- `/contact`
- `/contact-sales`
- `/cookies`
- `/demo`
- `/desktop`
- `/developers`
- `/developers/api`
- `/developers/changelog`
- `/developers/docs`
- `/developers/docs/errors`
- `/developers/pricing`
- `/developers/roi`
- `/developers/status`
- `/downloads`
- `/free-60-day-pilot`
- `/grants`
- `/integrations`
- `/legal/account-deletion`
- `/legal/dpa`
- `/legal/privacy`
- `/legal/sub-processors`
- `/legal/terms`
- `/ng911-software`
- `/press`
- `/pricing`
- `/privacy`
- `/product`
- `/product/campus`
- `/product/core`
- `/product/venue`
- `/psap-software`
- `/public-safety-intelligence`
- `/rapid-cortex`
- `/rc-lite`
- `/request-demo`
- `/security`
- `/sms-consent`
- `/solutions`
- `/solutions/agencies`
- `/solutions/vendors`
- `/stadium-security-software`
- `/status`
- `/supervisor-dashboard`
- `/terms`
- `/trust`
- `/venue`
- `/venue-safety-integrations`
- `/venue-safety-software`
- `/venue/how-it-works`
- `/blog/{slug}` (dynamic)

**Not indexed**
- `/blog/rss.xml`
- `/developers/docs/{...slug}`
- `/developers/playground`
- `/developers/sandbox`
- `/developers/simulation`
- `/developers/webhooks-test`
- `/enter`
- `/login`
- `/rc-lite/portal` (+ nested portal pages)
- `/signup`
- `/unsubscribe`

---

## D. Ops / product app (not this marketing map)

Authenticated product UI lives on **`https://app.rapidcortex.us`** (and staging hosts), not in the marketing sitemap. Examples: `/{jurisdiction}/dashboard`, `/app/venue/*`, `/app/campus/*`, `/rc-admin/*`, `/app/call-assist/*`. See role routing in `.cursorrules` / `docs/role-dashboard-spec.md`.

---

## E. Maintenance

1. Add a new public page → create `apps/marketing/app/(marketing)/…/page.tsx` **and** add a `PUBLIC_ROUTES` entry in `apps/marketing/app/sitemap.ts`.
2. Bump `STABLE_LAST_MODIFIED` in `sitemap.ts` when the public set changes.
3. Redeploy marketing (`scripts/deploy-marketing.sh`) so `/sitemap.xml` updates.
4. Keep [GOOGLE_ANALYTICS_INDEX.md](./GOOGLE_ANALYTICS_INDEX.md) content groups aligned with section A.

---

## F. Related

| Resource | Path |
|---|---|
| Sitemap generator | `apps/marketing/app/sitemap.ts` |
| Robots | `apps/marketing/app/robots.ts` |
| GA4 index | [GOOGLE_ANALYTICS_INDEX.md](./GOOGLE_ANALYTICS_INDEX.md) |
| Site constants | `apps/marketing/lib/site.ts` |
