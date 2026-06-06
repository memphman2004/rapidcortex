# Training quickstart (~20 minutes)

For **trainers** onboarding dispatchers and supervisors before pilot go-live. Pair with live agency SOPs; Rapid Cortex is **decision support**, not dispatch authority.

**Role-specific deep dives (live UI, no screenshots):** [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md) · [TRAINING_SUPERVISOR.md](./TRAINING_SUPERVISOR.md) · [TRAINING_ADMIN.md](./TRAINING_ADMIN.md) · [COMMON_TASKS.md](./COMMON_TASKS.md) · [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md) · [QUICKSTART_CARD.md](./QUICKSTART_CARD.md).

## Before class (trainer)

- [ ] Confirm **production or training** URL and that **Connections** shows Rapid Cortex API **live** for pilot (not offline mock).
- [ ] Create **training accounts** (dispatcher + supervisor) with correct `custom:agencyId`.
- [ ] Prepare **one test incident** or use agency SOP for creating the first live incident.
- [ ] Open [USER_GUIDE.md](./USER_GUIDE.md) and [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) on a second screen.

## Minute 0–5: Orientation

1. Open `https://www.rapidcortex.us/<agency-slug>/login` (or your host).
2. Explain **jurisdiction slug** vs **tenant** (security is JWT + API, not the slug).
3. Sign in as dispatcher; land on **`/dashboard`**.

## Minute 5–12: Dispatcher workspace

1. **Incident queue** — Select an incident; show title, status, urgency.
2. **Transcript** — Explain **English `text`** vs **original language** lines when multilingual is on; point out **interpreter review** and **confidence** badges when present.
3. **Intelligence** — Run **Refresh AI** once; read disclaimer (suggestions, not orders).
4. **Scripted transcript on `/dashboard`** — On pilot hosts the chunk player may be **hidden by default** when the API is live; use **`/demo`** for scripted academy playback, or enable **`NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM=1`** only when deliberately POSTing practice chunks from the dashboard ([NON_GOALS.md](./NON_GOALS.md) §5, [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)). Not a substitute for CAD/radio ingest.

## Minute 12–17: History and review

1. **`/history`** — Filter and open a completed/archived row.
2. **`/review`** (if in scope) — Supervisor queue for second-line review.

## Minute 17–20: Admin (optional audience)

1. **`/admin/integrations`** — Read-only status for admins only.
2. **`/admin/audit`** — What appears and what is redacted.

## After class

- Direct students to **`/<slug>/demo`** only for **scripted** exercises ([USER_GUIDE.md](./USER_GUIDE.md)).
- Capture questions for [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) updates.

## Related

- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)
- [SUPPORT_MODEL.md](./SUPPORT_MODEL.md)
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
- [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)
