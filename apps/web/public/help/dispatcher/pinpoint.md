# Pinpoint Location

**NexiQ Pinpoint / Pinpoint iQ** asks for a high-accuracy GPS fix when the Pinpoint module is enabled. Use it when ALI is weak, the caller is mobile, or the address is unclear.

There are two channels that share the same secure token model:

| Channel | How the reporter gets the link | Typical use |
|--------|--------------------------------|-------------|
| **SMS** | Dispatcher sends `/pinpoint/t/{token}` by SMS | PSAP / ECC live call |
| **Browser** | Campus/venue QR report with live-location opt-in | Campus ops (no SMS) |

## When to use Pinpoint

- Caller is outdoors and can accept a location SMS/link (SMS channel)
- Campus reporter opted in to share live location on a QR report (browser channel)
- ALI or Phase II is unreliable or missing
- Caller says they are "near" a landmark and you need a map pin
- Welfare check or abandoned-vehicle style non-fixed addresses

Do **not** rely on Pinpoint indoors (malls, parking decks, hospitals) as the sole location source.

## How to request (SMS)

1. Select the active incident in your workspace.
2. Open **NexiQ Pinpoint** in the right panel.
3. Confirm the caller's mobile number in E.164 format (example: `+18165551234`).
4. Click **Send Pinpoint link**.
5. Coach the caller: "Tap the link and Allow Location if your phone asks."
6. When they approve, the map pin and status card update in your workspace.
7. Verify the pin against what the caller says and against CAD/ALI before you commit a location in CAD.

## Campus / QR (browser)

When a reporter opts in on a QR safety report, Pinpoint iQ creates a browser session immediately (no SMS). Campus ops sees **Pinpoint iQ** with LIVE / STALE / SHARING STOPPED badges. The original QR scan point is **SCAN ONLY** — never treat it as live GPS.

## Status badges

| Badge | Meaning |
|-------|---------|
| **LIVE** | Consented session with a recent GPS update |
| **STALE** | Consented session; last update is older than the freshness window |
| **SHARING STOPPED** | Caller stopped sharing, operator revoked, or the link expired |
| **SCAN ONLY** | Fixed QR/NFC place only — not live device GPS |
| **LOCATION UNAVAILABLE** | Session waiting for the first accepted GPS fix |

## Caller stop sharing

The caller can tap **Stop sharing** on the Pinpoint page. That **revokes the token on the server** so further GPS posts are rejected (410). Closing the browser may also send a revoke beacon. Operators can revoke from the dispatcher panel as well.

## Reading the result

- Map pin = caller-approved device location at the moment it was accepted
- Accuracy circle can be large — treat it as assistive, not survey-grade
- If the pin conflicts with the caller's spoken address, ask clarifying questions; agency SOP wins

## Failures and fallbacks

- SMS did not deliver → confirm mobile (not landline), resend once, then use Caller Video Assist or spoken location
- Caller declines permission → document that in notes and continue with ALI / verbal location
- Caller stops sharing → status becomes SHARING STOPPED; last known pin remains historical
- Pinpoint panel missing → module may be off for your agency; escalate to Agency Admin / IT

## Audit

Every Pinpoint generate, location capture, and revoke (caller or operator) is written to the incident audit trail automatically.

Pinpoint is decision support. It does **not** replace your agency location protocol or CAD authority.
