# Pinpoint Location

**NexiQ Pinpoint** asks the caller's phone for a high-accuracy GPS fix when the Pinpoint module is enabled for your agency. Use it to confirm location when ALI is weak, the caller is mobile, or the address is unclear.

## When to use Pinpoint

- Caller is outdoors and can accept a location SMS/link
- ALI or Phase II is unreliable or missing
- Caller says they are "near" a landmark and you need a map pin
- Welfare check or abandoned-vehicle style non-fixed addresses

Do **not** rely on Pinpoint indoors (malls, parking decks, hospitals) as the sole location source.

## How to request

1. Select the active incident in your workspace.
2. Open **NEXCORT IQ PINPOINT** in the right panel.
3. Confirm the caller's mobile number in E.164 format (example: `+18165551234`).
4. Click **Send location request**.
5. Coach the caller: "Tap the link and Allow Location if your phone asks."
6. When they approve, the map pin appears in your workspace.
7. Verify the pin against what the caller says and against CAD/ALI before you commit a location in CAD.

## Reading the result

- Map pin = caller-approved device location at the moment they tapped Allow
- Accuracy circle can be large — treat it as assistive, not survey-grade
- If the pin conflicts with the caller's spoken address, ask clarifying questions; agency SOP wins

## Failures and fallbacks

- SMS did not deliver → confirm mobile (not landline), resend once, then use Caller Video Assist or spoken location
- Caller declines permission → document that in notes and continue with ALI / verbal location
- Pinpoint panel missing → module may be off for your agency; escalate to Agency Admin / IT

## Audit

Every Pinpoint send, accept, and decline is written to the incident audit trail automatically.

Pinpoint is decision support. It does **not** replace your agency location protocol or CAD authority.
