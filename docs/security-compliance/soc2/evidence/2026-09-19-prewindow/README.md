# Pre-window closeout — executed 2026-09-19

**Not a Type II report.** This folder records the 1–7 closeout list from [OBSERVATION-WINDOW.md](../../OBSERVATION-WINDOW.md).

| # | Activity | Result 2026-09-19 | Artifact |
|---|---------|-------------------|----------|
| 1 | Live AWS re-snapshot | **DONE on Mac Mini** 2026-09-19T01:41Z (`20260919T014158Z`). Commit `docs/evidence/soc2-evidence/2026-09/` from that machine. | [07-live-mac-mini.md](./07-live-mac-mini.md) |
| 2 | Named owners | **DONE (interim)** — Jeff Coleman is management / security / eng / on-call until roles are split. Agency rows stay blank. Personal email **not** committed. | [02-owners.md](./02-owners.md), [OPS_CONTACT_MATRIX](../../../operations-runbooks/OPS_CONTACT_MATRIX.md) |
| 3 | Access review | **DONE live export** — review MFA/groups in `2026-09/access-review`, then sign the ledger. | [03-access-review.md](./03-access-review.md), [07-live-mac-mini.md](./07-live-mac-mini.md) |
| 4 | Vendor review | **DONE** — secrets inventory vs subprocessor list; list updated. | [04-vendor-review.md](./04-vendor-review.md) |
| 5a | IR tabletop | **DONE** — discussion-based scenario 1 (IAM key leak), combined-role attendee. | [05-tabletop.md](./05-tabletop.md) |
| 5b | Restore drill | **DONE** — Scan COUNT 13218/13218 vs source; restore copy deleted; production not cut over. | [07-live-mac-mini.md](./07-live-mac-mini.md) |
| 6 | Policy signatures | **PACKET READY** — wet signatures still required. | [../SIGNATURE-PACKET.md](../../SIGNATURE-PACKET.md) |
| 7 | CPA engagement | **PACKET READY** — SOW draft; do not send until management approves. | [../CPA-ENGAGEMENT-SOW.md](../../CPA-ENGAGEMENT-SOW.md) |

**Next on Jeffs-Mac-mini:** `git add docs/evidence/soc2-evidence/2026-09 && git commit && git push`. Wet-sign [SIGNATURE-PACKET.md](../../SIGNATURE-PACKET.md). Send [CPA-ENGAGEMENT-SOW.md](../../CPA-ENGAGEMENT-SOW.md) when ready.
