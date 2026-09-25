# Vulnerability scan evidence — 2026-09-24 post-fix

Dependency remediation + rescan for questionnaire **VULN-02**.

| Artifact | Description |
|---|---|
| `npm-audit-report.json` | Full `npm audit --json` after remediation |
| `npm-audit-summary.txt` | Human-readable audit report |
| `test-security.txt` | `npm run test:security` (39/39 pass) |
| `../2026-09-24/` | Pre-fix baseline (87 findings) |

## Before → after

| | Before | After |
|---|---:|---:|
| Total | 87 | **19** |
| Critical | 6 | **0** |
| High | 24 | **0** |
| Moderate | 51 | 18 |
| Low | 6 | 1 |

## What we changed

- Bumped `next` / `eslint-config-next` → **16.3.6**, `vitest` → **4.1.11**, `maplibre-gl` → **6.11.1**
- Desktop: `electron` → **44.4.5**, `vite` → **6.4.3**, `concurrently` → **10.0.5**
- Android: `aws-amplify` → **6.22.0**, `@aws-amplify/auth` → **6.21.1**, `axios` → **1.20.0**
- Root `overrides` for transitive pins: `fast-xml-parser`, `shell-quote`, `brace-expansion`, `js-yaml`, `sharp`, `image-size`, `@xmldom/xmldom`, `fast-uri`, `postcss`, `undici`, `ws`, `form-data`, `nanoid`, `axios`, `vite`
- Replaced unpatched `xlsx` (high, no fix) with `exceljs` in `scripts/seed-psap-prospects.ts`

## Remaining (accepted / blocked)

- **Expo SDK 53 chain** (~16 moderate): audit suggests Expo 46 / SDK 57 majors — incompatible with current Expo 53 + RN 0.79 pin. Track for next Expo upgrade.
- **exceljs** (moderate, direct): preferred over unfixed SheetJS `xlsx` high.
- **esbuild** (low, transitive via Vite tooling).

Process: [SECURITY_TRIAGE_PROCESS.md](../../../security-compliance/SECURITY_TRIAGE_PROCESS.md).
