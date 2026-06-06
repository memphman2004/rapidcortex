# Dispatcher training — live product paths

**Audience:** ECC dispatchers and call-takers on a **real pilot** stack. This guide matches the current web app (`apps/web`); there are **no screenshots** so it stays in sync—use your agency’s live URL while teaching.

**Also read:** [USER_GUIDE.md](./USER_GUIDE.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), [COMMON_TASKS.md](./COMMON_TASKS.md).

## 1. Before you sign in

- Use the **URL your IT team gave you** (`…/<slug>/login`). The **slug** is for routing only; **your access** is controlled by Cognito (`custom:agencyId`, `custom:role`).
- Check the **Connections** strip at the bottom after login: **Rapid Cortex API** should show **live** for pilot (not offline). If it says offline, stop and contact **agency IT** or your supervisor ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)).

## 2. Dashboard (`/<slug>/dashboard`)

### Incident queue (left)

1. Click an incident row to select it.
2. You see **title**, **status**, **urgency**, and related fields from the API.

### Transcript (center)

Each line shows:

| UI element | Meaning | When uncertain |
|------------|---------|----------------|
| **Speaker** badge (`caller`, `dispatcher`, `system`) | Who the line is attributed to | Treat as assistive labeling; verify against audio/SOP. |
| **English text** (`text`) | Primary line shown for operations | If **Original:** appears below, the pipeline kept the source-language text separately—read both. |
| **Interpreter review** badge | The multilingual pipeline flagged the segment for **human interpreter follow-up** | Do **not** rely on automated translation alone; follow agency policy for interpreter callback or bilingual staffing. Hover shows the same guidance in-app. |
| **Low confidence** badge | STT or translation fell **below configured thresholds** | Re-ask, slow down, or bring an interpreter; hover shows threshold guidance in-app. |
| **STT nn%** | Speech-to-text confidence when provided | Low or missing STT does not block dispatch judgment. |
| **Tr nn%** | Translation confidence when provided | Same as above. |
| **STT fallback / Translate fallback** | A backup provider tier was used | Note in CAD/narrative per SOP if required. |
| **Lang xx** | Detected or declared original language code | Use for awareness; not legal determination of language access. |

**Training vs production:** Scripted chunk controls on the dashboard may be **off** on your host. Academy playback uses **`/<slug>/demo`** ([NON_GOALS.md](./NON_GOALS.md) §5).

### Intelligence (right panel)

- Header **Intelligence** — hover explains: structured triage **for this incident**, suggestions only.
- **Refresh AI** — calls `POST …/analyze` for the selected incident. Wait for result or read the **red error box** if the API declines (e.g. unchanged transcript)—note **`requestId`** if shown for support.
- **Confidence** meter — **AI triage** confidence for the analysis block (not the same as per-line STT % in the transcript); hover explains in-app.
- **Category / Urgency / Escalation** badges — model output; **your agency SOP wins** if they disagree.
- **Protocol coach** (when present) — agency-approved pack content; read **disclaimer** at bottom of the coach card.
- **Dispatch actions** (mark reviewed, escalate) — real `PATCH` calls; only use per SOP.

## 3. When the system is uncertain

1. **Prefer human verification** — caller safety over model speed.
2. **Interpreter review / low confidence** — escalate per floor policy; do not “talk past” unclear language.
3. **AI errors** — capture time (UTC), incident id, screenshot of Connections + error text; give to supervisor for [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) routing.

## 4. History (`/<slug>/history`)

- Browse past incidents for your agency; open a row to see the same transcript + analysis pattern as the dashboard.

## Related

- [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md) (trainer-led 20-minute version)
- [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md)
- [QUICKSTART_CARD.md](./QUICKSTART_CARD.md)
