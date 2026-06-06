# Feedback loop (pilot learning)

**Purpose:** how field feedback becomes **tickets, docs, and scope clarity** without overselling.  
**Metrics detail:** [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md). **Meeting shell:** [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md).

---

## 1. Principles

1. **No PII in public decks** unless agency policy allows—use redaction and internal secure storage.  
2. **Every production-impacting anecdote** ties to `requestId`, UTC time, environment, and role when possible ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)).  
3. **Documentation is part of the product**—when a boundary is learned, update [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) or [FAQ_INTERNAL.md](./FAQ_INTERNAL.md).

---

## 2. How feedback is collected

| Channel | Best for | Owner |
|---------|----------|-------|
| **Fortnightly pilot review** | Themes, governance, prioritization | RC pilot lead + agency champion |
| **Support inbox / ticket queue** | Defects, config mistakes, urgency | Support per [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) |
| **Admin → Audit export** | Operational trace for retro | Agency admin |
| **Supervisor sampling form** (optional spreadsheet) | AI agree/disagree counts | Agency supervision |
| **Engineering triage** | Repro + `GIT_SHA` | RC engineering |

**In-app:** errors that surface `requestId` / `errorCode` should be copied into tickets verbatim (values only, not full payloads with secrets).

---

## 3. Cadence

| Cadence | Activity |
|---------|----------|
| **Weekly** (active pilot) | Support triage; check integration status for new warnings |
| **Fortnightly** | [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md) joint session |
| **Monthly** | Roll up metrics vs [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md); exec readout |
| **Exit / go-no-go** | [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) + commercial review |

---

## 4. Outputs (definition of done for a feedback item)

| Outcome | When |
|---------|------|
| **Ticket** filed with severity and environment | Always for defects |
| **RUNBOOK / TROUBLESHOOTING** update | If ops recurring |
| **KNOWN_LIMITATIONS** update | If expectation mismatch is “by design” |
| **PROMISE_CONTROL / SALES** update | If sales language caused the drift |
| **FEATURE_MATRIX** maturity change | If capability shipped or intentionally descoped |

---

## 5. Promise control tie-in

Before closing a retro, ask: **“Did we learn anything that changes what we may say externally?”** If yes, route through [PROMISE_CONTROL.md](./PROMISE_CONTROL.md) and [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md).

---

## Related

- [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md)  
- [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)  
