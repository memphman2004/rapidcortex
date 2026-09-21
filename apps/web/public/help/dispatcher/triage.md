# AI triage and confidence score

**Intelligence** shows structured triage for **this incident** only: category, urgency, escalation badges, and a **confidence** meter.

## Refresh analysis

1. Select the incident.
2. Click **Refresh AI**.
3. Wait for the result, or read the red error panel. Copy **requestId** for support if shown.

## How to read confidence

- The meter is **AI triage** confidence for the analysis block — not the same as per-line **STT %** in the transcript.
- **Low confidence** or **Interpreter review** on transcript lines means slow down, re-ask, or follow interpreter SOP.
- Category / urgency are model output. **SOP wins**.

Never let a high confidence score skip a safety check you would have done without the software.
