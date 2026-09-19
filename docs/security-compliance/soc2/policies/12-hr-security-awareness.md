# POL-12 Personnel security and awareness

| Field | Value |
|-------|--------|
| Policy ID | POL-12 |
| TSC | CC1.4, CC6.2, CC6.3 |
| Owner | HR + Security lead (NEEDS OWNER) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual |

**Not a Type II report.** Do not store background-check reports, SSNs, or health data in this repository.

## 1. Screening

Personnel with production AWS or Restricted operational data access complete screening commensurate with their role (criminal background as required by contract/CJIS **agency** programs). Rapid Cortex does not assert CJIS personnel certification for customers.

## 2. Training

| When | Topic |
|------|--------|
| Hire (before prod access) | POL-01, POL-02, tenant isolation, no certification overclaim, IR reporting |
| Annual | Phishing, secret handling, incident reporting |
| Role change to privileged | Access control + change management |

Record completion in [hr-training-log.md](../evidence/hr-training-log.md) (name or employee ID **optional**; role + date required).

## 3. Onboarding / offboarding

[hr-onboarding-offboarding.md](../processes/hr-onboarding-offboarding.md). Collect laptop, disable Cognito, disable IAM keys, rotate secrets the person could have known (per SOP), remove vendor console logins.

## 4. Contractors

Same access policy as employees. Vendor contractors are also in POL-05.
