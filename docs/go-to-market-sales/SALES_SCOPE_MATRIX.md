# Sales & solutions — promise vs out of scope

**Purpose:** give sales, solutions engineers, and agency buyers a **single alignment table** so pilots do not start with mismatched expectations. Canonical detail lives in [MVP_SCOPE.md](./MVP_SCOPE.md) and [NON_GOALS.md](./NON_GOALS.md); this matrix is a **summary** — if they conflict, MVP + NON_GOALS win.

**Internal guardrails:** [PROMISE_CONTROL.md](./PROMISE_CONTROL.md), [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md), [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md), [FAQ_INTERNAL.md](./FAQ_INTERNAL.md).

| Capability | Pilot / MVP **does** deliver (at a high level) | Sales & SE **may** say (careful wording) | **Do not** promise (first-agency pilot) |
|------------|-----------------------------------------------|------------------------------------------|----------------------------------------|
| Dispatcher workspace | Browser UI: incident list, transcript view, AI-assisted analysis panel, dispatch notes/actions as implemented | “Co-pilot alongside CAD/radio — suggestions and summaries for trained staff” | Replacing CAD, 911 CPE, radio console, or logging as **system of record** |
| AI output | Structured assistive analysis with human review paths | “Decision support; agency defines when to act on AI output” | Autonomous dispatch, auto-CAD write-back without governance |
| Protocols | Protocol-aligned coaching where packs are configured and reviewed | “Guidance framed against agency-approved protocol catalog” | Medical/tactical procedures as authoritative without protocol backing ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)) |
| Multilingual | Voice/text pipeline **when** secrets and tables are configured per docs | “Multilingual assist when your deployment enables the pipeline” | Guaranteed accuracy; elimination of interpreter judgment |
| CAD / RMS | Incident creation via **product API** / admin flows unless a connector project exists | “Integration roadmap per vendor program” | Certified bidirectional CAD for every vendor |
| Training & demos | **`/demo`** scenarios; optional dashboard training controls when explicitly enabled | “Academy and evaluation paths separate from production traffic” | That demo traffic is real 911 or live CAD |
| Security & compliance | CJIS-**aligned** engineering patterns documented | “Controls designed for public-safety expectations” | CJIS, HIPAA, SOC 2, FedRAMP **certification** claims ([SECURITY_MODEL.md](./SECURITY_MODEL.md)) |
| Support | Pilot-shaped routing per [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) | “Joint pilot channel with defined escalation” | Unlimited 24/7 NOC for all third-party vendors |

## Talking points (short)

- **Tenant isolation:** JWT `custom:agencyId` + API enforcement — not the URL slug alone ([USER_GUIDE.md](./USER_GUIDE.md)).
- **Offline vs live:** Mock incident queue and scripted paths are **opt-in** and documented ([NON_GOALS.md](./NON_GOALS.md) §5, [DEMO_DEBT_INVENTORY.md](./DEMO_DEBT_INVENTORY.md)).
- **Expansion:** Re-run [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) when adding agencies or environments.

## Related

- [GTM_PACKAGE.md](./GTM_PACKAGE.md) — full onboarding package index
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md) — buyer-safe narrative
- [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) — maturity labels (live / limited / configured / future)
- [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md) — governance framing
- [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) — measurable pilot evaluation
