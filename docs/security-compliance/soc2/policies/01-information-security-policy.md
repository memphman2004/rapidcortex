# POL-01 Information security policy

| Field | Value |
|-------|--------|
| Policy ID | POL-01 |
| TSC | CC1.1, CC1.2, CC1.3, CC2.1, CC5.1 |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management / board equivalent |
| Effective | DRAFT 2026-09-19 — not in force until signed |
| Review | Annual, or after a SEV-1, or after a material architecture change |

**This document is not a SOC 2 Type I or Type II report.**

## 1. Purpose

Protect the confidentiality, integrity, and availability of Rapid Cortex production systems and customer operational data (incident metadata, transcripts, AI output, audit events, media). Rapid Cortex is an **assistive** platform; it does not replace CAD, 911, dispatchers, or medical direction.

## 2. Scope

Applies to all personnel, contractors, and systems in [SYSTEM-BOUNDARY.md](../SYSTEM-BOUNDARY.md), including the live stack `rapid-cortex-dev`.

## 3. Principles

1. **Least privilege** and **tenant isolation** (`agencyId` on every data access; `AuthorizationService.canPerform()` at handler entry).
2. **Fail-closed** for high-risk features (CAD write-back stays off unless a signed addendum exists).
3. **No certification overclaim** (SOC 2, CJIS, HIPAA, FedRAMP) — [PROMISE_CONTROL.md](../../../go-to-market-sales/PROMISE_CONTROL.md).
4. **Secrets never in git**; ARNs only.
5. **Audit** meaningful state changes.
6. **Human-in-the-loop** for AI; no autonomous dispatch.

## 4. Roles (fill names off-git)

| Role | Accountability |
|------|----------------|
| Management | Approves this pack; risk acceptance; CPA engagement |
| Security lead | Policies, access reviews, vendor reviews, IR, auditor liaison |
| Engineering lead | IaC, change control, restore drills, feature flags |
| On-call engineer | Detection response per [OPS_CONTACT_MATRIX.md](../../../operations-runbooks/OPS_CONTACT_MATRIX.md) |
| Agency administrators | Their own users (CUEC) |

## 5. Policy suite

POL-02 through POL-12 and the SOPs under `processes/` implement this policy. Conflicts: this policy wins on scope/claims; the more specific SOP wins on procedure.

## 6. Exceptions

Written risk acceptance with owner, expiry ≤ 90 days, and ticket ID. Logged in [risk-register.md](../evidence/risk-register.md).

## 7. Violations

Access revocation, contractor termination, and incident handling under POL-07. Customer notification per executed DPA/MSA — not this file.
