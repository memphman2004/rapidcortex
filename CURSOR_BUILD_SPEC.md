# Rapid Cortex C2C Hub — Cursor Build Spec

**Track 2** · Vendor leverage for Charleston County CAD-to-CAD (RFP **6212-27L**, due 2026-10-06; user shorthand **6212-26L**).  
**Stance:** no-bid as **prime**. This hub is the demo + partner-API story, not an RFP response.

Run the 16 steps **in order**. Steps 1–7 are pure TypeScript (no runtime npm deps besides the packages themselves).

| Step | Package / artifact | Done when |
|------|--------------------|-----------|
| 1 | Scaffold `@rc/common-codes` | `packages/common-codes` builds |
| 2 | APCO/NENA common incident type catalog | lookup by code + discipline |
| 3 | Tests for common-codes | `vitest` green |
| 4 | Scaffold `@rc/eido` | `packages/eido` builds, **no** npm deps |
| 5 | NENA-STA-021.1b transfer-shaped types | `$id`, components, version |
| 6 | `buildEido` / `parseEido` / `validateEido` | round-trip + reject invalid |
| 7 | Tests for eido (incl. transfer sample) | `vitest` green |
| 8 | `@rc/c2c-hub` types + transfer-rule engine | source/dest/type/geo match |
| 9 | `C2cCadAdapter` interface | ingest + deliver |
| 10 | **Mock adapter (demo engine)** | Berkeley producer, Charleston sink |
| 11 | Seed agencies + pre-loaded transfer rules | Berkeley → Charleston |
| 12 | Hub engine | CAD event → EIDO → rules → deliver |
| 13 | Demo + tests | simulated incidents route on EIDO |
| 14 | Southern Software + CentralSquare stubs | partner-shaped field maps |
| 15 | `SOUTHERN_SOFTWARE_API_SPEC.md` + `CENTRALSQUARE_API_SPEC.md` | inquiry-ready |
| 16 | Partner inquiry emails + no-bid note | templates only (do not bid 6212-27L as prime) |

## Demo scenario

Mock CAD in **Berkeley County, SC** emits incidents. The hub normalizes each to a NENA EIDO and applies seed rules. Matching types (structure fire, injury MVC, pursuit, cardiac) transfer to **Charleston County, SC** Consolidated 9-1-1 in EIDO form.

```bash
npx vitest run packages/common-codes packages/eido packages/c2c-hub
npx tsx packages/c2c-hub/src/run-demo.ts
```

## Vendor outreach (not a bid)

Email Southern Software and CentralSquare using `docs/c2c-hub/emails/`. Ask: **partner API program inquiry** for EIDO / CAD-to-CAD. RFP deadline October 6 — outreach now, while Charleston County is evaluating.

**Do not send mail from CI or this agent.** Templates only. A human attaches `SOUTHERN_SOFTWARE_API_SPEC.md` / `CENTRALSQUARE_API_SPEC.md` and sends. Do **not** bid 6212-27L (shorthand 6212-26L) as prime.
