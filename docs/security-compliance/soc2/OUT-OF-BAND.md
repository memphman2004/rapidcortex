# Out-of-band SOC 2 work (cannot be completed in this repository)

This pack finishes **in-repo** design of CC1–CC9. The items below still need people, a CPA firm, live AWS, or counsel. Track them in [DOCUMENT_GAPS.md](../../go-to-market-sales/DOCUMENT_GAPS.md) (`SOC-*` and existing `LEG-*` / `PLT-*` rows).

| ID | Item | Owner | Blocks Type II? | Status 2026-09-19 |
|----|------|-------|-----------------|-------------------|
| SOC-101 | Engage AICPA / CPA firm | Management | **Yes** | **PACKET** [CPA-ENGAGEMENT-SOW.md](./CPA-ENGAGEMENT-SOW.md) — not sent |
| SOC-102 | Management signatures on POL-01–12 | Management | **Yes** | **PACKET** [SIGNATURE-PACKET.md](./SIGNATURE-PACKET.md) |
| SOC-103 | Named security lead, on-call, HR | Management | **Yes** | **DONE interim** Jeff Coleman; no deputy (R-SOC-015) |
| SOC-104 | Background checks / signed awareness | HR | **Yes** | **PARTIAL** training log row; HR files off-git |
| SOC-105 | Execute IR tabletop | Security + Eng | **Yes** | **DONE** [05-tabletop.md](./evidence/2026-09-19-prewindow/05-tabletop.md) |
| SOC-106 | Execute restore drill (new table) | Eng | **Yes** | **LIVE REQUESTED** `rapid-cortex-audit-dev-restore-20260919` CREATING — wait ACTIVE, validate, delete copy |
| SOC-107 | Monthly live observation packs | Eng | **Yes** | **DONE** Mac Mini stamp `20260919T014158Z` — commit `docs/evidence/soc2-evidence/2026-09/` |
| SOC-108 | Signed shared-account carve-out | Management | Firm-dependent | Same signature packet |
| SOC-109 | Pen-test SOW / report | Security | Often requested | Open (LEG-010) |
| SOC-110 | Executed DPA / MSA | Legal | Customer + CC9 | Open |
| SOC-111 | AWS Artifact SOC reports | Security | CC6.8 inherited | Open |
| SOC-112 | Entity naming (AOD vs Rapid Cortex LLC) | Legal | LEG-007 | Open |
| SOC-113 | PagerDuty/SNS paging proven (PLT-025) | Ops | CC7 detection | Open |
| SOC-114 | Dedicated AWS account migration | Eng | Residual R-SOC-001 | Post-window |
| SOC-115 | Break-glass during in-flight SAM deploy | Eng | No | Opened from tabletop |

Do **not** send real vendor emails, rotate live secrets, or run `soc2-enable-live-controls.sh` from a workstation that lacks the production profile unless change control says so.

**Still forbidden in sales copy:** “SOC 2 Type II”, “SOC 2 certified”, “CJIS certified.”
