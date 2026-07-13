# Rapid Cortex Connect — Ring Certification Reviewer Guide (v3)

**App name:** Rapid Cortex Connect  
**Reviewer test account:** ring-reviewer@rapidcortex.us  
**Temp password:** RapidTest2026! (change on first login if prompted)  
**Direct login path:** https://app.rapidcortex.us/test-agency/media  

> **Agency note:** Cognito `custom:agencyId` for this reviewer is `test-agency`.  
> Do **not** use `/columbus-state/media` — that slug does not match the reviewer tenant and will show empty cameras.

---

## What this integration does

Rapid Cortex Connect allows 911 dispatchers to request temporary, consent-gated live
video access from Ring camera owners near an active emergency incident.

**Key principles:**
- Every video request requires explicit owner approval — every time
- Nothing is automatic or standing — each request is a one-time ask
- The owner receives an SMS and must tap Allow before any video is shared
- Access is time-limited (10, 30, 60, or 120 minutes)
- The owner can decline or revoke access at any time (STOP SHARING in the same SMS)

---

## Part 1 — Link your Ring account as a dispatcher

### Step 1 — Sign in

1. Go to **https://app.rapidcortex.us/test-agency/media**
2. Sign in: `ring-reviewer@rapidcortex.us` / `RapidTest2026!`
3. Land on the **Media** tab

### Step 2 — Connect Ring Account

1. Media → **Ring** → **Connect Ring Account**
2. Complete Ring OAuth (`oauth.ring.com`)
3. Return to `https://www.rapidcortex.us/connect/ring/link?status=success`
4. Sign back into Rapid Cortex

### Step 3 — Enable devices + confirm GPS

1. Media → Ring → **Linked Devices** (or Manage devices)
2. Confirm each device shows **GPS: lat, lng** (green) — not “No location”
3. Toggle **Enabled for Connect** on at least one device
4. If GPS is missing after link, contact support or run ops GPS seed for `test-agency`

**Empty camera list root cause (v2):** devices without GPS or Enable for Connect off are excluded from radius search.

---

## Part 2 — Per-incident camera request flow

1. Create an **Active** incident at the camera’s address (caller GPS required)
2. Media → Ring → **View Available Ring Cameras**
3. Default radius **500m**; UI offers **100 / 250 / 500 / 1000 / 2000**
4. Send Emergency Video Request (10 / 30 / 60 / 120 min)
5. Owner taps **ALLOW** in SMS (public GET link, no login)
6. Dispatcher sees **APPROVED** → **View Live Stream** (KVS WebRTC)
7. End access: dispatcher **End Access**, or owner **STOP SHARING** in SMS

Rate limits: max 5 requests/incident/hour; one active request per camera/incident.

---

## Part 3 — Policy and legal pages (required URLs)

| Page | URL |
|------|-----|
| Website | https://www.rapidcortex.us |
| Privacy Policy | https://www.rapidcortex.us/legal/privacy/ |
| Terms | https://www.rapidcortex.us/legal/terms/ |
| Support | https://www.rapidcortex.us/contact/ |
| Sign-in | https://app.rapidcortex.us/login |
| Post-OAuth landing | https://www.rapidcortex.us/connect/ring/link |

---

## Part 4 — Homeowner / Ring account holder experience

### Opt-in

- Ring Appstore → Rapid Cortex Connect → enable devices  
- Or https://www.rapidcortex.us/connect/ring/start  
- Appstore account link sign-in: https://www.rapidcortex.us/connect/ring/link?nonce=…&time=…

### SMS format (sent on request)

```
RAPID CORTEX EMERGENCY REQUEST
[Agency Name] is requesting temporary access to your [Device Name]
for an active emergency near your address.
Incident type: [type]
Duration: 30 minutes

ALLOW: https://…/api/integrations/ring/consent/{token}/approve
DECLINE: https://…/api/integrations/ring/consent/{token}/decline
STOP SHARING: https://…/api/integrations/ring/consent/{stopToken}/stop

Every request requires your approval. You can disconnect anytime.
```

Consent links are **GET** (tappable from SMS). No Rapid Cortex login required.

### Guarantees

- No video without per-request approval  
- Time-limited; auto-expires  
- Owner can decline or STOP mid-session  
- Owner can remove the app in Ring My Apps  

---

## Pre-submit checklist (ops)

- [ ] `ring-reviewer@rapidcortex.us` can sign in at `/test-agency/media`
- [ ] At least one linked device with **GPS** + **Enabled for Connect**
- [ ] Incident at that address returns the camera at 500m
- [ ] SMS Allow / Decline / Stop all open HTML confirmation pages
- [ ] Live stream opens; End Access works
- [ ] Legal URLs in Part 3 return HTTP 200
- [ ] Token Exchange URL + Account Link URL + Webhook URL registered in Ring Developer Portal (Appstore one-way flow)
  - Account Link: `https://www.rapidcortex.us/connect/ring/link`
  - App Homepage: `https://www.rapidcortex.us/connect/ring/start`
  - Token Exchange: `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/token-exchange`
  - Webhook: `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/webhook`

GPS seed (if needed):

```bash
STAGE=dev AGENCY_ID=test-agency DEVICE_NAME_CONTAINS=Living \
  npx tsx scripts/seed-ring-sonoma-point-gps.ts
```

**SMS phone:** After **Connect Ring Account**, Rapid Cortex syncs the Ring profile phone onto the Cognito reviewer user when Ring returns it. If SMS still falls back to email, set Cognito `phone_number` (E.164) on `ring-reviewer@rapidcortex.us` and re-test.
