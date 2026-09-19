# POL-06 Risk assessment policy

| Field | Value |
|-------|--------|
| Policy ID | POL-06 |
| TSC | CC3.1–CC3.4 |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Quarterly |

**Not a Type II report.**

## 1. Objectives

Keep Rapid Cortex available as an assistive layer, prevent cross-tenant disclosure, prevent unauthorized CAD write-back, and avoid overstated compliance claims.

## 2. Registers

| Register | Use |
|----------|-----|
| [phase-0/risk-register.md](../../../phase-0/risk-register.md) | Product / pilot safety (R1–R8) |
| [soc2/evidence/risk-register.md](../evidence/risk-register.md) | SOC 2 / infrastructure (R-SOC-*) |

Score impact × likelihood qualitatively (Low / Med / High / Critical). Critical items need a named owner and a date.

## 3. Triggers (re-assess immediately)

- New PII field or logging of content fields
- IAM/Cognito widening
- Shared-account other-product added
- Enablement of CAD write-back, Wyze, Nest citizen OAuth, or new AI vendor
- SEV-1/SEV-2 incident
- CPA firm scoping change

## 4. Risk acceptance

Written, time-bounded (≤ 90 days unless management renews), ticketed. Shared-account carve-out is accepted for the first observation window (R-SOC-001) with dedicated-account tracked as improvement.

Procedure: [risk-assessment.md](../processes/risk-assessment.md).
