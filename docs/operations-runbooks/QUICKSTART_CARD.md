# Quickstart card (agency rollout)

**One-page handout** — no screenshots; reprint when UI labels change. Full paths: [USER_GUIDE.md](./USER_GUIDE.md).

## Sign in

- URL: `https://<your-host>/<slug>/login`
- **Connections** (bottom): **Rapid Cortex API = live** before taking real work.

## Dispatcher (60 seconds)

1. **`/dashboard`** → pick incident in queue.
2. **Transcript** — read English line; if **Interpreter review** or **Low confidence** → follow SOP for interpreter / verify meaning.
3. **Intelligence** → **Refresh AI** for suggestions; **not** orders. Errors in **red** → note time + incident id + any `requestId`.
4. **Dispatch actions** only per SOP.

## Supervisor

- **`/review`** when in scope; use transcript badges + Intelligence together.
- Escalate outages with UTC time + screenshot of **Connections** ([ESCALATION_PATHS.md](./ESCALATION_PATHS.md)).

## Admin

- **`/admin/configuration`** — env + integration snapshot.
- **`/admin/users`** — create / Save / Deactivate (no re-enable in UI).
- **`/admin/audit`** — spot-check events.

## Training vs live

- **`/demo`** = scripted academy only. **`/dashboard`** = live API work ([NON_GOALS.md](./NON_GOALS.md) §5).

## Deep training

- [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md) · [TRAINING_SUPERVISOR.md](./TRAINING_SUPERVISOR.md) · [TRAINING_ADMIN.md](./TRAINING_ADMIN.md)
