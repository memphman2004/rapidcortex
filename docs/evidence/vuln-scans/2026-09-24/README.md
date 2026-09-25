# Vulnerability scan evidence — 2026-09-24 (UTC)

Dependency + in-repo security suite run for questionnaire **VULN-02** (IU).

| Artifact | Description |
|---|---|
| `npm-audit-report.json` | Full `npm audit --audit-level=moderate --json` |
| `npm-audit-summary.txt` | Human-readable audit report |
| `test-security.txt` | `npm run test:security` (Vitest RBAC / JWT / tenant isolation) |
| `scan-secrets.txt` | `npm run security:scan-secrets` |

## Results (this run)

| Gate | Result |
|---|---|
| `npm run test:security` | **Pass** — 9 files / 39 tests |
| `npm audit` | **Findings present** — 87 total (6 critical, 24 high, 51 moderate, 6 low) |
| `npm run security:scan-secrets` | **Exit 0** with 2 pattern hits (review before merge): CloudTrail evidence sample JSON (AWS key id pattern); `infra/template.monolith.before-nested.yaml` (PEM pattern) |

Process: [SECURITY_TRIAGE_PROCESS.md](../../../security-compliance/SECURITY_TRIAGE_PROCESS.md).

**Not included in this pack:** third-party penetration test (LEG-010), CodeQL/Semgrep/Checkov/Trivy (operator CI optional tools — not installed for this local run).

Share with IU under NDA; triage critical/high before go-live per SECURITY_TRIAGE_PROCESS SLAs.
