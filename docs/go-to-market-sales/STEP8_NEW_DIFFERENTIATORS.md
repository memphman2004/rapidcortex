# Step 8 — New differentiators (post F1–F9)

**Gate:** Do not start these epics until the competitive build tracks **F1 through F9** are complete and stable in your target environments. F1–F9 cover parity-style capabilities (QA, media, protocols, triage, wellness, caller card, leadership analytics, cross-jurisdiction sharing, supervisor performance, etc.). Step 8 is intentionally **separate** so product and engineering can sequence “win the table stakes” before “win on differentiation.”

**Label:** Items below are the **N — New** differentiators (not the same bucket as F-features).

---

## Epic N1 — Incident narrative auto-draft

**Outcome:** From transcript + structured incident fields, generate a concise, agency-tunable narrative (CAD/RMS-ready or internal handoff) with human review before send.

**Depends on:** Rich transcript + analysis pipeline (F-era), auditability, and clear PII/retention policy.

---

## Epic N2 — Training simulator with adaptive caller voice

**Outcome:** Academy-grade simulator with scenario library, stress/pace adaptation, and voice characteristics that shift with trainee performance; ties to existing training/demo flows where appropriate.

**Depends on:** Stable multilingual / voice stack and incident workspace patterns from the competitive build.

---

## Epic N3 — Workforce and burnout intelligence

**Outcome:** Agency-scoped signals (patterns across shifts, incident types, optional wellness signals where enabled) with supervisor-facing insights—not clinical diagnosis—and strict role/tenant boundaries.

**Depends on:** Audit and analytics foundations; alignment with F5 wellness posture (supervisor-only where applicable).

---

## Epic N4 — Remote / hybrid dispatch verification

**Outcome:** Technical and procedural checks that a remote or hybrid console session meets agency policy (identity, geojurisdiction hints, session integrity, optional step-up auth).

**Depends on:** Auth model, audit, and agency admin configuration surfaces.

---

## Epic N5 — Municipal reporting package

**Outcome:** Scheduled or on-demand exports and narrative summaries formatted for municipal oversight (counts, response themes, redaction profiles)—separate from raw CAD export.

**Depends on:** Analytics aggregation, agency scoping, and CSV/report patterns from leadership analytics work.

---

## Epic N6 — Certification and compliance tracking

**Outcome:** Track dispatcher/supervisor certifications, expirations, and required training completions; alerts and readouts for admins and optional export for audits.

**Depends on:** User/agency model, admin routes, and audit trail conventions.

---

## Epic N7 — Peer support integration

**Outcome:** Handoff or referral paths to vetted peer-support programs (no therapy claims), with logging and privacy controls configurable per agency.

**Depends on:** Incident context APIs and clear separation from clinical or emergency dispatch duties.

---

## Epic N8 — NG911 readiness checklist

**Outcome:** Static and evolving checklist mapped to NG911 / ESInet expectations, with evidence links and per-agency completion state—not a certification body, a product-guided readiness tracker.

**Depends on:** Admin or platform surfaces for persistence and reporting.

---

## Sequencing guidance

1. **Inventory dependencies** for each epic against shipped F1–F9 behavior (API, web, SAM, compliance).
2. **Pick 1–2 epics** for a first Step 8 release train; avoid parallelizing all eight.
3. **Define “done” per epic** with pilot customers (e.g., one agency type, one export format, one simulator modality).
4. **Revisit after each train** so NG911 and municipal reporting do not starve incident-facing quality work.

For deployment and flag patterns for F-era features, see `docs/FEATURE_FLAGS.md` and `docs/DEPLOYMENT.md`.
