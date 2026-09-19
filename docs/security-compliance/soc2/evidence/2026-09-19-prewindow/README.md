# Pre-window closeout — executed 2026-09-19

**Not a Type II report.** This folder records the 1–7 closeout list from [OBSERVATION-WINDOW.md](../../OBSERVATION-WINDOW.md).

| # | Activity | Result 2026-09-19 | Artifact |
|---|---------|-------------------|----------|
| 1 | Live AWS re-snapshot | **PARTIAL** — no AWS CLI/credentials in this environment. Integrity-attested the 2026-09-17/10 CLI pack (182/182 PITR, CloudTrail logging, MFA ON, WAF logging). **Must re-run on a workstation with `AWS_PROFILE=rapid-cortex` before 2026-10-01.** | [01-technical-snapshot.md](./01-technical-snapshot.md), [hashes](../../../../evidence/soc2-evidence/2026-09-prewindow/hashes.sha256) |
| 2 | Named owners | **DONE (interim)** — Jeff Coleman is management / security / eng / on-call until roles are split. Agency rows stay blank. Personal email **not** committed. | [02-owners.md](./02-owners.md), [OPS_CONTACT_MATRIX](../../../operations-runbooks/OPS_CONTACT_MATRIX.md) |
| 3 | Access review | **DONE with exceptions** — privileged principals from Track 1 evidence; live IAM/Cognito group export blocked (no AWS). | [03-access-review.md](./03-access-review.md) |
| 4 | Vendor review | **DONE** — secrets inventory vs subprocessor list; list updated. | [04-vendor-review.md](./04-vendor-review.md) |
| 5a | IR tabletop | **DONE** — discussion-based scenario 1 (IAM key leak), combined-role attendee. | [05-tabletop.md](./05-tabletop.md) |
| 5b | Restore drill | **DRY_RUN DONE** — PITR proven on 182/182 from TSV; live `restore-table-to-point-in-time` blocked (no AWS). | [06-restore-drill.md](./06-restore-drill.md) |
| 6 | Policy signatures | **PACKET READY** — wet signatures still required. | [../SIGNATURE-PACKET.md](../../SIGNATURE-PACKET.md) |
| 7 | CPA engagement | **PACKET READY** — SOW draft; do not send until management approves. | [../CPA-ENGAGEMENT-SOW.md](../../CPA-ENGAGEMENT-SOW.md) |

**Blocked on a machine with `AWS_PROFILE=rapid-cortex`:** live observation pack, live access-review export, live PITR restore to a new table.
