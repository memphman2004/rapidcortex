# Out-of-band SOC 2 work (cannot be completed in this repository)

This pack finishes **in-repo** design of CC1–CC9. The items below still need people, a CPA firm, live AWS, or counsel. Track them in [DOCUMENT_GAPS.md](../../go-to-market-sales/DOCUMENT_GAPS.md) (`SOC-*` and existing `LEG-*` / `PLT-*` rows).

| ID | Item | Owner | Blocks Type II? |
|----|------|-------|-----------------|
| SOC-101 | Engage AICPA / CPA firm; define period and category | Management | **Yes** — no report without a firm |
| SOC-102 | Management/board signatures on policies 01–12 | Management | **Yes** — CC1 |
| SOC-103 | Named security lead, on-call, HR owner (replace NEEDS OWNER) | Management | **Yes** — CC1.3 |
| SOC-104 | Background checks / signed security-awareness for personnel with prod access | HR | **Yes** — CC1.4 |
| SOC-105 | Execute IR tabletop; attach attendees and findings | Security + Eng | **Yes** — CC7 sample |
| SOC-106 | Execute restore drill (new table only); attach CLI | Eng | **Yes** — CC7.5 sample |
| SOC-107 | Monthly live observation packs starting 2026-10 | Eng | **Yes** — operating effectiveness |
| SOC-108 | Signed shared-account carve-out (or dedicated account) | Management | Firm-dependent |
| SOC-109 | Pen-test SOW / report | Security | Often requested; LEG-010 |
| SOC-110 | Executed DPA / MSA | Legal | Customer + CC9 |
| SOC-111 | AWS Artifact SOC reports (inherited physical) | Security | CC6.8 inherited |
| SOC-112 | Entity naming (AOD LLC vs Rapid Cortex LLC) | Legal | LEG-007 |
| SOC-113 | PagerDuty/SNS paging proven (PLT-025) | Ops | CC7 detection |
| SOC-114 | Dedicated AWS account migration (post-window) | Eng | Residual R-SOC-001 |

Do **not** send real vendor emails, rotate live secrets, or run `soc2-enable-live-controls.sh` from a workstation that lacks the production profile unless change control says so.

**Still forbidden in sales copy:** “SOC 2 Type II”, “SOC 2 certified”, “CJIS certified.”
