# Ring Developer Portal — Notes for Reviewer (paste exactly)

Each field must be **20–4000 characters**. Paste one section per portal field.

---

## Field 1 — How can a Ring reviewer create an account on your platform?

```
Rapid Cortex Connect uses two account types. For Appstore certification, use BOTH as described.

A) Ring Device Owner (homeowner) account — created during Appstore account linking
1. In the Ring app (US account that owns at least one camera), open Appstore → search “Rapid Cortex Connect” → Get App.
2. Select device(s) and confirm scopes. Ring redirects the browser to:
   https://www.rapidcortex.us/connect/ring/link?nonce=…&time=…
3. On that page, choose Create account (preferred for first-time owners) or Sign in.
4. Create a Rapid Cortex device-owner account with email + password (min 12 chars with upper, lower, number, symbol). Prefer the same email as the Ring account.
5. After success you see “Connected” with your camera name(s). Return to Ring — status should show Connected (not Pending).

B) Dispatcher review account (to request video and view live stream)
• Email: ring-reviewer@rapidcortex.us
• Temporary password: RapidTest2026! (change if Cognito prompts)
• Sign-in URL: https://app.rapidcortex.us/login
• After login go ONLY to: https://app.rapidcortex.us/test-agency/media
• Agency / Cognito custom:agencyId must be test-agency. Do NOT use /columbus-state/media (wrong tenant → empty cameras).

Support: support@rapidcortex.us
Privacy: https://www.rapidcortex.us/legal/privacy/
Terms: https://www.rapidcortex.us/legal/terms/
```

---

## Field 2 — How can a Ring reviewer perform account linking?

```
IMPORTANT: Use the Ring Appstore one-way flow only. Do NOT use Media → “Connect Ring Account” inside Rapid Cortex for certification.

Portal production settings (must match):
• Account Link: https://www.rapidcortex.us/connect/ring/link
• App Homepage: https://www.rapidcortex.us/connect/ring/start
• Token Exchange: https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/token-exchange
• Webhook: https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/webhook
(Optional) Copy the same four URLs into Staging settings so portal Test mode hits the same backends.

Linking steps:
1. On a phone signed into a Ring account that owns a US camera, open Ring → Appstore → Rapid Cortex Connect → Get App.
2. Select devices + confirm. Ring POSTs the OAuth code to Token Exchange (background).
3. Browser opens Account Link with nonce + time query params.
4. Create account or Sign in on Rapid Cortex (device-owner account — not dispatcher login).
5. Backend matches nonce → POST /accounts/me/app-integrations → PATCH status completed → discovers devices into agency test-agency.
6. Confirmation page lists device name(s). Ring app should show Connected.

If GPS is missing on a device after link, ask Rapid Cortex ops to seed coordinates (device will otherwise be excluded from radius search). Enable “Enabled for Connect” on at least one device under Media → Ring → Linked Devices when signed in as ring-reviewer@rapidcortex.us.
```

---

## Field 3 — How can a Ring reviewer test the end-to-end integration with your app?

```
Prerequisites: Appstore link completed for a Ring camera; ring-reviewer@rapidcortex.us signed in at https://app.rapidcortex.us/test-agency/media; at least one device with GPS + Enabled for Connect.

E2E emergency video request:
1. Create an Active incident near the camera address (caller GPS required) in the test-agency workspace.
2. Media → Ring → View Available Ring Cameras. Default radius 500m (UI also offers 100/250/500/1000/2000).
3. Send Emergency Video Request (duration 10 / 30 / 60 / 120 minutes).
4. Owner phone receives SMS from Rapid Cortex with ALLOW / DECLINE / STOP SHARING links (public GET pages — no login).
5. Tap ALLOW → confirmation HTML. Dispatcher UI shows APPROVED → View Live Stream (KVS WebRTC).
6. Verify End Access (dispatcher) and optionally STOP SHARING (owner SMS) mid-session.
7. Decline path: send a second request and tap DECLINE — no stream.

Owner disconnect / data controls:
• Ring → My Apps → remove Rapid Cortex Connect (webhook disables devices).
• Self-serve account deletion: https://www.rapidcortex.us/connect/ring/link#delete-account (email used during linking)
• Privacy: https://www.rapidcortex.us/connect/ring/start#privacy-data and https://www.rapidcortex.us/privacy/
• Email DSAR/deletion: support@rapidcortex.us

Expected guarantees: no video without per-request Allow; time-limited access; owner can stop anytime; no standing law-enforcement feed.

Legal URLs (HTTP 200): https://www.rapidcortex.us/legal/privacy/ · /legal/terms/ · /contact/
```
