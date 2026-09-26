# NexCort iQ cutover (keep Rapid Cortex live)

**Updated:** 2026-09-25  
**Policy:** Rapid Cortex stays fully operational. NexCort iQ naming rolls out in phases. No big-bang host flip for the authenticated product until Cognito, cookies, CORS, and agency bookmarks are ready.

| Surface | Live today | Target |
|---|---|---|
| Marketing brand copy | **NexCort iQ** (formerly Rapid Cortex) | Keep |
| Marketing host | `www.nexcortiq.us` **and** `www.rapidcortex.us` both **200** (same site) | `www.nexcortiq.us` canonical; Rapid Cortex **301** → NexCort |
| Product / ops host | `https://app.rapidcortex.us` | Stay until Phase D |
| Email / SES | Mixed (`@nexcortiq.us` + `@rapidcortex.us`) | Prefer `@nexcortiq.us`; keep Rapid Cortex identities valid |
| Google Search Console | Verify **domain** `nexcortiq.us`; keep Rapid Cortex property for legacy | Primary = NexCort |
| GA4 | Stream may still list Rapid Cortex hosts | Primary URL `https://www.nexcortiq.us` |

Canonical marketing constants live in `apps/marketing/lib/site.ts` (`SITE_NAME`, `SITE_FORMER_NAME`, `SITE_MARKETING_ORIGIN`).

---

## Principles

1. **Product uptime first** — never break `app.rapidcortex.us`, Cognito callbacks, or agency SSO while renaming.
2. **SEO continuity** — path-preserving 301s; do not collapse Rapid Cortex URLs to the homepage.
3. **Dual allowlist** — CORS, splash gate, CSP, and Cognito callback lists keep both brand hosts until Phase E.
4. **Legal / contracts** — agency SOWs and invoices may still say Rapid Cortex; UI can say NexCort iQ with “formerly Rapid Cortex” where needed.
5. **No silent DNS cut of app** — `app.nexcortiq.us` is an **alias later**, not a replacement on day one.

---

## Phase A — Dual-live marketing (current)

**Status: DONE / in progress**

- [x] Marketing site branded **NexCort iQ** with former-name phrases where needed
- [x] Canonical origin `https://www.nexcortiq.us` in `site.ts` / sitemap / meta
- [x] Both `www.nexcortiq.us` and `www.rapidcortex.us` serve the marketing site (HTTP 200)
- [x] DNS TXT Google site verification on `nexcortiq.us` (plus existing MS + SPF)
- [ ] GSC: click **VERIFY** on domain property `nexcortiq.us`
- [ ] GSC: submit `https://www.nexcortiq.us/sitemap.xml` on the **nexcortiq.us** property
- [ ] GA4: primary stream URL + Search Console link per [GOOGLE_ANALYTICS_INDEX.md](./GOOGLE_ANALYTICS_INDEX.md)

**Do not** take Rapid Cortex marketing offline in this phase.

---

## Phase B — Marketing 301 cutover (SEO)

**Status: DONE (2026-09-25)** — CF Function on dual-brand dist `EWZ286WS69KX1`

Live marketing CloudFront **`EWZ286WS69KX1`** aliases:

- `rapidcortex.us`, `www.rapidcortex.us`
- `nexcortiq.us`, `www.nexcortiq.us`

Standalone `infra/rapidcortex-us-redirect.yaml` is **not** used (`CNAMEAlreadyExists`). Enabled via:

```bash
AWS_PROFILE=default bash scripts/enable-marketing-legacy-host-redirect.sh
```

Function: `nexcortiq-marketing-legacy-host-redirect`  
Source: `infra/cloudfront/marketing-legacy-host-redirect.js`

| Request | Response |
|---|---|
| `https://www.rapidcortex.us/pricing?x=1` | `301` → `https://www.nexcortiq.us/pricing?x=1` |
| `https://nexcortiq.us/...` | `301` → `https://www.nexcortiq.us/...` |
| `https://www.nexcortiq.us/...` | `200` (unchanged) |
| `https://app.rapidcortex.us/*` | **unchanged** (dist `E1T1KDP4B7PNW7`) |

Checklist:

- [x] Run enable script (admin profile)
- [x] Spot-check Rapid Cortex URLs (pricing, privacy, query preserved)
- [x] Confirm `app.rapidcortex.us` still 307 → login
- [ ] GSC Rapid Cortex property: monitor coverage as traffic shifts
- [x] `nexcortiq.com` → `www.nexcortiq.us` (`nexcortiq-com-redirect` CREATE_COMPLETE)

Standalone template `infra/rapidcortex-us-redirect.yaml` reserved if Rapid Cortex CNAMEs are ever removed from `EWZ286WS69KX1`.

---

## Phase C — In-product naming (hosts unchanged)

**Status: MOSTLY DONE (visible chrome)**

Keep **URLs** on `app.rapidcortex.us`. Change **visible strings** and logos to NexCort iQ:

- [x] Rapid iQ / NexiQ product naming cleanup (dashboard copy)
- [x] NexCort logo asset in `apps/web/public/Logo/`
- [x] Web `SITE_NAME` / metadata / OG → NexCort iQ (`apps/web/lib/site.ts`, `app/layout.tsx`)
- [x] TOTP Authenticator issuer → `NexCort iQ` (`apps/web/lib/auth/totp-otpauth.ts`)
- [ ] Remaining internal symbols (`RapidCortexMap`, `migrateLegacyRapidCortexRoleTokenValue`, package names) — **leave**; not customer-facing
- [ ] Downloads / desktop wrappers: display name NexCort iQ; download URLs may stay on Rapid Cortex CDN until Phase D
- [ ] Support macros and email signatures → `@nexcortiq.us`

Repo folder / git remote may keep “Rapid Cortex” indefinitely; that is not customer-facing.

---

## Phase D — App host alias (optional, later)

**Do not start until Phase B is stable and Cognito is inventoried.**

1. Provision `app.nexcortiq.us` (ACM + CloudFront/ALB alias) pointing at the **same** web ECS service as `app.rapidcortex.us`.
2. Add both origins to Cognito callback/logout URLs, CORS allowlists, and web env.
3. Soft-launch: RC staff use `app.nexcortiq.us`; agencies keep bookmarks on Rapid Cortex.
4. Announce agency cutover window; dual-host for ≥ 90 days.
5. Only then prefer NexCort links in new contracts and onboarding.

**Out of scope for early phases:** renaming Cognito pool IDs, DynamoDB table prefixes (`rapid-cortex-*`), or CloudFormation stack names — those stay internal forever unless a dedicated infra migration is approved.

---

## Phase E — Deprecate Rapid Cortex public brand

**Only after** SEO rankings transfer and contracts are updated:

- [ ] Marketing Rapid Cortex 301s remain ≥ 12 months
- [ ] Stop new Rapid Cortex trademarks in ads / decks
- [ ] Keep email receive on `@rapidcortex.us` (forward) as long as customers use it
- [ ] Update SOWs / MSA templates to NexCort iQ legal trade name

---

## Explicit non-goals (for now)

| Leave alone | Why |
|---|---|
| `app.rapidcortex.us` as primary login | Agencies bookmarked; Cognito callbacks |
| Dynamo / Lambda physical names `rapid-cortex-*` | Zero customer value; high blast radius |
| Killing Rapid Cortex DNS | Breaks bookmarks and email |
| Forcing CAD / partner integrations to new host | Partner allowlists lag |

---

## Immediate next actions (this week)

1. Finish GSC **VERIFY** for `nexcortiq.us` → submit `https://www.nexcortiq.us/sitemap.xml`.
2. ~~Phase B marketing 301s~~ — **done** 2026-09-25.
3. Keep Rapid Cortex GSC + GA streams until coverage fully shifts.
4. Later (optional): Phase D `app.nexcortiq.us` alias — not required for marketing cutover.
