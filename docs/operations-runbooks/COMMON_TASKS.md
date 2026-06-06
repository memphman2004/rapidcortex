# Common tasks (step-by-step, live UI)

No screenshots — steps reference **labels exactly as shown** in the product today (`apps/web`).

## Dispatcher tasks

### Select and work an incident

1. Go to **`/<slug>/dashboard`**.
2. Click a row in the **incident queue** (left).
3. Read **detail** / timeline strip if shown for your build.

### Refresh AI analysis

1. With an incident selected, open **Intelligence** (right).
2. Click **Refresh AI**.
3. Wait for loading to finish OR read the **red** error panel. Copy **`requestId`** if present for support.

### Mark reviewed / escalate (when SOP allows)

1. In **Intelligence**, use **Dispatch actions** at the bottom of the panel.
2. Confirm prompts if shown.

### Handle multilingual transcript lines

1. If a line shows **Original:** under the English text, compare both.
2. If **Interpreter review** appears, follow agency interpreter policy (do not skip).
3. If **Low confidence** or low **STT % / Tr %**, slow down and verify meaning.

### Find past work

1. Open **`/<slug>/history`**.
2. Open a row to see transcript + analysis for that incident.

## Supervisor tasks

### Second-line review

1. Open **`/<slug>/review`** when in pilot scope.
2. Validate AI summary and transcript flags before closing the supervisory action.

## Admin tasks

### Create a user

1. **`/<slug>/admin/users`** → **Invite / create user** form.
2. Fill email, confirm **Agency ID** (fixed if you are agency admin), role, temp password → **Create user**.

### Verify integration health

1. **`/<slug>/admin/configuration`** or **`/<slug>/admin/integrations`**.
2. Confirm **Multilingual config issues** = **0** when strict mode is on for your stage.

### Spot-check audit

1. **`/<slug>/admin/audit`** — newest events; expand details in secure environment if needed.

## Related

- [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md)
- [TRAINING_ADMIN.md](./TRAINING_ADMIN.md)
- [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)
