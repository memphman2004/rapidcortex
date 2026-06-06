# Supervisor training — live product paths

**Audience:** comms supervisors overseeing pilot dispatchers. Matches current `apps/web` routes; **no screenshots** (stays aligned with code).

**Also read:** [USER_GUIDE.md](./USER_GUIDE.md), [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md), [SUPPORT_MODEL.md](./SUPPORT_MODEL.md).

## 1. What supervisors do in Rapid Cortex

- **Same dispatcher surfaces** where your deployment exposes them, plus **audit** list access when the role allows ([ADMIN_GUIDE.md](./ADMIN_GUIDE.md)).
- **Second-line review** of escalations and AI-assisted summaries—**policy and SOP** define when to intervene.

## 2. Review queue (`/<slug>/review`)

Use your agency’s in-scope workflow:

1. Open **`/<slug>/review`** (if enabled for your pilot).
2. Work incidents flagged for supervisor attention (source depends on API/UI wiring—confirm with your pilot lead).
3. Cross-check **Intelligence** outputs and **transcript badges** (Interpreter review, Low confidence) before closing a concern.

## 3. Reading transcript + AI together

- **Interpreter review** — treat as **mandatory human follow-up** channel, not a suggestion to ignore.
- **Low confidence / STT / Tr %** — use to prioritize which calls get **live QA** or call-back.
- **AI Escalation badge** — correlates with model `escalationFlag`; still verify against audio/CAD narrative.

## 4. Supporting dispatchers mid-shift

| Symptom | First action |
|---------|----------------|
| API offline in Connections | Confirm widespread vs single browser; open pilot channel per [ESCALATION_PATHS.md](./ESCALATION_PATHS.md). |
| Repeating AI errors | Collect `requestId`, UTC time, incident id; route per [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md). |
| Role / permission confusion | Verify JWT claims with IT; dispatchers get **403** on admin integration APIs by design. |

## 5. Audit (`/<slug>/admin/audit`) when your role allows

- Newest-first operational events; details may truncate in the table—use for **spot checks** and trend awareness, not sole legal export (counsel defines process).

## Related

- [TRAINING_ADMIN.md](./TRAINING_ADMIN.md) (if you also wear an admin hat)
- [COMMON_TASKS.md](./COMMON_TASKS.md)
