# Pilot review template (cadence meeting)

**Purpose:** a repeatable agenda for pilot governance and success review—**internal + agency** joint session.  
**Cadence:** fortnightly minimum during active pilot ([FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md)).  
**Metrics inputs:** [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md).

---

## Meeting metadata

| Field | Value |
|-------|--------|
| Date (UTC) | |
| Attendees (roles) | RC: — / Agency: — |
| Environment reviewed | staging / pilot — URL: |
| Release / `GIT_SHA` | |

---

## 1. Safety and governance (5 min)

- Any events touching autonomous dispatch, CAD write-back, or policy breaches? **Y / N** — notes:  
- Escalations used as designed ([ESCALATION_PATHS.md](./ESCALATION_PATHS.md))?  
- Audit sampling outcome (if performed):  

---

## 2. Operations and reliability (10 min)

- API / UI availability anecdote vs monitoring ([MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md)):  
- Top **3** support tickets since last meeting (title + `requestId` if applicable, **no PII** in shared notes):  
- Integration posture: multilingual issue count, connector mode (**Admin → Integrations** screenshot optional):  

---

## 3. Usage and adoption (10 min)

- Active users / sessions trend (rough counts):  
- New users provisioned / deactivated:  
- Training completions or gaps:  

---

## 4. Product experience (15 min)

**Transcript / translation**

- Interpreter-review and low-confidence rates—expected or alarming?  
- Any language pair failures?  

**AI analysis**

- Analyze failures by `errorCode` category:  
- Supervisor spot-check summary (agree / disagree / edit):  

---

## 5. Scope and promise control (5 min)

- Any new customer asks that sound out of scope? ([PROMISE_CONTROL.md](./PROMISE_CONTROL.md))  
- Updates needed to [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) or [FAQ_INTERNAL.md](./FAQ_INTERNAL.md):  

---

## 6. Actions (owned)

| # | Action | Owner | Due |
|---|--------|-------|-----|
| 1 | | | |
| 2 | | | |

---

## 7. Retro quality check

- [ ] Notes stored in agency-approved location  
- [ ] Tickets filed for defects  
- [ ] Docs updated when a new boundary was discovered  
