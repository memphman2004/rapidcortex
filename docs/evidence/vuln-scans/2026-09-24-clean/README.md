# Vulnerability scan evidence — 2026-09-24 clean

`npm audit` after full remediation for questionnaire **VULN-02**.

| Artifact | Description |
|---|---|
| `npm-audit-report.json` | Full `npm audit --json` |
| `npm-audit-summary.txt` | Human-readable audit |
| `test-security.txt` | `npm run test:security` |
| `scan-secrets.txt` | `npm run security:scan-secrets` (clean) |
| `SECRET-SCAN-RESOLUTION.md` | Disposition of prior AKIA / PEM hits |

## Result

| | Baseline (pre-fix) | Mid | **Final** |
|---|---:|---:|---:|
| Total | 87 | 19 | **0** |
| Critical | 6 | 0 | **0** |
| High | 24 | 0 | **0** |
| Moderate | 51 | 18 | **0** |
| Low | 6 | 1 | **0** |
| Secret scan | 2 hits | — | **0 blocked** |

## Remediations (this pass)

- Override `uuid` → **11.1.1** (cleared Expo / exceljs / gaxios / xcode chain)
- Override `ajv` → **8.20.0** + lockfile pin under `expo-dev-launcher` (cleared expo-dev-client ReDoS)
- Override `esbuild` → **0.28.2**

Prior pass also: Next 16.3.6, Vitest 4.1.11, MapLibre 6.11.1, Electron 44.4.5, Amplify/axios bumps, transitive overrides, `xlsx` → `exceljs`.

Process: [SECURITY_TRIAGE_PROCESS.md](../../../security-compliance/SECURITY_TRIAGE_PROCESS.md).
