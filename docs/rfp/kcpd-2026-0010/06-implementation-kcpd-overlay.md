# Implementation, training & maintenance — KCPD Call Assist overlay  
## Bid Lines 23–25

Base plan: [../implementation-and-transition.md](../implementation-and-transition.md) (12-week first-agency template).  
This overlay specializes that plan for **Call Assist on the non-emergency line** at ~450k NE calls/year.

Fill **Owner / Date** columns in the agency workbook before contract signature. Do not submit blank dates as if they were committed.

---

## 1. Workstreams

| Workstream | Day-1 | Later |
|------------|-------|-------|
| Call Assist SaaS (Lex, sessions, QA, analytics, knowledge, admin) | Yes | Tuning |
| Amazon Connect contact flows + DID on **non-emergency** path | Yes (with telephony partner) | Soak / scale |
| External directory (311, Parks, Water, …) | Seed + agency confirm | Ongoing admin |
| Online report / CARFAX URLs | Seed KCPD URLs | Policy updates |
| PremierOne **review packet** (write-back **off**) | Yes | — |
| PremierOne **live create** | No | After signed CAD addendum + UAT |
| Motorola Records live | No | Optional project |
| Certified 911 TTY CPE | Out of scope (agency) | — |

---

## 2. Suggested schedule (Call Assist)

Compress only if Connect DID and Cognito are already decided.

| Week | Focus | Exit criteria |
|------|-------|---------------|
| 1 | Kickoff, SOW, named PM + KCPD sponsor / ITSU / floor lead | Assistive SOW signed; CAD write-back remains off |
| 2 | Retention (Sunshine mapping), disclosure language, knowledge seed review | Policy checkpoints dated |
| 3 | Tenant + Call Assist roles (`CALL_ASSIST_*`); MFA | Admins sign in |
| 4 | Connect test DID + Lex un-mock in staging; ANI/ALI attrs | Test call reaches session UI |
| 5 | External transfers + self-service URLs confirmed by KCPD | Warm-transfer test pass |
| 6 | PremierOne connector credentials (sandbox); review-packet only | Packet renders; send gated |
| 7 | Training: admin / supervisor / call taker / technical | Attendance logged |
| 8 | Parallel ops on limited cohort; demo scenarios as drills | Floor fallback briefed |
| 9 | Tune prompts, triage, false-transfer review | Punch-list owners |
| 10 | UAT + acceptance | Signed UAT or dated punch-list |
| 11 | Transition to support; named account manager | Support matrix filled |
| 12 | Hypercare close; optional restore drill | Retro complete |

**CAD Phase 2** (live write) starts only after separate go/no-go — not forced into week 8.

---

## 3. Training (Line 23)

| Audience | Topics | Duration (typical) |
|----------|--------|--------------------|
| Call takers | Disclosure, transfer triggers, intake review, self-service diversion | 2–4 hr |
| Supervisors | Live monitor, QA scoring, false-transfer, CAD review queue | 2–3 hr |
| Administrators | Prompts, knowledge, routing, retention, external directory | 3–4 hr |
| Technical / ITSU | Connect, Cognito, flags, audit export, support escalation | 2–3 hr |
| Train-the-trainer | Facilitation + `/demo` scenario library | 2 hr |
| CJIS awareness | Assistive AI + data handling (product docs) | Included |

Refresher cadence: per SOW (recommend 90-day post go-live).

---

## 4. Cutover & rollback (Line 24)

**Cutover pattern:** Parallel operations. Non-emergency AI path goes live for a cohort; 911 CPE and CAD unchanged.

**Abort go-live:** Disable Call Assist DID routing / set users inactive → floor returns to existing non-emergency handling. Stacks retained.

**Bad deploy:** Redeploy prior API/web release; keep `CAD_WRITEBACK_ENABLED=false` and Call Assist CAD push off unless Phase 2 is active.

Details: base pack §2–3.

---

## 5. Maintenance (Line 25)

| Item | Standard posture |
|------|------------------|
| Technical support | Per [SUPPORT_MODEL.md](../../operations-runbooks/SUPPORT_MODEL.md) — 24×7 platform path as sold |
| Named account manager | Named in SOW |
| Software updates / security patches | Continuous delivery with change control |
| Quarterly business reviews | Containment, transfer, false-transfer, language, volume |
| Annual health check | Config, flags, Connect/Lex, CAD gate status, retention |

---

## 6. Demo readiness (evaluation)

Scripted scenarios: library id `kcpd-rfp-2026` (abandoned vehicle, noise, theft, parking, suspicious, welfare, mid-call emergency).  
Operator guide: [KCPD_CALL_ASSIST_DEMO_PLAYBOOK.md](../../go-to-market-sales/KCPD_CALL_ASSIST_DEMO_PLAYBOOK.md).

**Do not** patch a production DID into Zoom for the scored demo unless Connect/Lex are un-mocked and rehearsed in-room.

---

## Version

| Date | Notes |
|------|-------|
| 2026-09-27 | KCPD Call Assist overlay for 2026-0010 |
