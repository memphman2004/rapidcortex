# POL-05 Vendor and subprocessor management

| Field | Value |
|-------|--------|
| Policy ID | POL-05 |
| TSC | CC9.1 |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Quarterly |

**Not a Type II report.**

## 1. Inventory

Canonical list: [SUBPROCESSOR_LIST.md](../../SUBPROCESSOR_LIST.md). AWS is the primary processor. Optional AI vendors (OpenAI, Anthropic, Azure, Google) process data **only** when secret ARNs are configured. CJIS-sensitive tenants stay AWS-only.

## 2. Before adding a subprocessor

1. Document purpose, data categories, region, and whether it is default-on or flag-gated.
2. Confirm DPA / AWS artifact / vendor security page exists (store off-git).
3. Update SUBPROCESSOR_LIST.md in the same change as the code/IaC that enables the vendor.
4. Do not send production incident content to a new model provider without that change control.

## 3. Ongoing

- Quarterly review of the list vs deployed secret ARNs (`scripts/soc2-observation-pack.sh` secret **names** only).
- Vendor incident at a subprocessor → NexCort iQ IR (POL-07) and customer notice per DPA.
- CAD vendors are **agency-chosen** integrators; NexCort iQ does not bid as prime on Charleston C2C RFP 6212-27L.

## 4. Evidence

[vendor-review-log.md](../evidence/vendor-review-log.md) + [vendor-management.md](../processes/vendor-management.md).
