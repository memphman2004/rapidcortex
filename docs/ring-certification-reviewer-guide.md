# Rapid Cortex Connect — Ring Certification Reviewer Guide (v4)

**App name:** Rapid Cortex Connect  
**Reviewer test account:** ring-reviewer@rapidcortex.us  
**Temp password:** RapidTest2026! (change on first login if prompted)  
**Direct login path:** https://app.rapidcortex.us/test-agency/media  

> **Agency note:** Cognito `custom:agencyId` for this reviewer is `test-agency`.  
> Do **not** use `/columbus-state/media` — that slug does not match the reviewer tenant and will show empty cameras.

## Certification package (portal paste)

| Doc | Purpose |
|-----|---------|
| [ring-certification/PRIVACY_LEGAL_QUESTIONNAIRE.md](./ring-certification/PRIVACY_LEGAL_QUESTIONNAIRE.md) | Privacy & Legal questionnaire answers (5 tabs) |
| [ring-certification/REVIEWER_NOTES.md](./ring-certification/REVIEWER_NOTES.md) | Three “Add notes for reviewer” fields |
| [ring-certification/SUBMIT_RUNBOOK.md](./ring-certification/SUBMIT_RUNBOOK.md) | Portal URLs + attestation + ops checklist |

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

## Part 1 — Link a Ring account (Appstore one-way — required)

> **Do not use** Media → **Connect Ring Account** for Appstore cert unless Stack 4
> with partner-initiated OAuth (`scope=ava.v1:read` + PKCE) is already deployed.
> Appstore linking is started from the **Ring app** (one-way Get App flow).

### Step 0 — Portal URLs (once)

In Amazon Developer → your app → **Account linking** → **Production settings**, save:

| Field | URL |
|-------|-----|
| Account Link | `https://www.rapidcortex.us/connect/ring/link` |
| App Homepage | `https://www.rapidcortex.us/connect/ring/start` |
| Token Exchange | `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/token-exchange` |
| Webhook | `https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/public/ring/webhook` |

Optional: copy the same URLs into **Staging settings** so portal Test mode hits production backends.

### Step 1 — Install from Ring Appstore (device-owner phone)

1. Open the **Ring** app on a phone signed into a Ring account that owns a US camera
2. Appstore → search **Rapid Cortex Connect** → **Get App**
3. Select device(s) + confirm scopes
4. Ring POSTs the OAuth code to Token Exchange (background — you won't see this)
5. Browser opens Account Link:  
   `https://www.rapidcortex.us/connect/ring/link?nonce=…&time=…`

### Step 2 — Create account / sign in (Rapid Cortex homeowner)

1. On the link page, prefer **Create account** (first-time), or **Sign in** if you already have a device-owner account
2. Prefer the same email as the Ring account when possible
3. Success shows **Account linked** with **device name(s)** (not raw device IDs)
4. Devices are discovered into agency `test-agency`

### Step 3 — Dispatcher sees devices

1. Go to **https://app.rapidcortex.us/test-agency/media**
2. Sign in: `ring-reviewer@rapidcortex.us` / `RapidTest2026!`
3. Media → Ring → **Linked Devices**
4. Confirm each device shows **GPS: lat, lng** (green) — not “No location”
5. Toggle **Enabled for Connect** on at least one device
6. If GPS is missing after link:

```bash
STAGE=dev AGENCY_ID=test-agency DEVICE_NAME_CONTAINS=Living \
  npx tsx scripts/seed-ring-sonoma-point-gps.ts
```

**Empty camera list:** devices without GPS or with Enable for Connect off are excluded from radius search.

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
| Privacy Policy | https://www.rapidcortex.us/privacy/ |
| Terms | https://www.rapidcortex.us/terms/ |
| Support | https://www.rapidcortex.us/contact/ |
| Sign-in | https://app.rapidcortex.us/login |
| App Homepage | https://www.rapidcortex.us/connect/ring/start |
| Post-OAuth landing | https://www.rapidcortex.us/connect/ring/link |
| Privacy & data deletion (in-app) | https://www.rapidcortex.us/connect/ring/start#privacy-data |

---

## Part 4 — Homeowner / Ring account holder experience

### Opt-in

- Ring Appstore → Rapid Cortex Connect → enable devices  
- Or https://www.rapidcortex.us/connect/ring/start  
- Appstore account link: https://www.rapidcortex.us/connect/ring/link?nonce=…&time=…

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
- Data deletion: Ring My Apps disconnect + privacy@rapidcortex.us + in-app Privacy & data section  

---

## Pre-submit checklist (ops)

- [ ] Paste questionnaire + reviewer notes (`docs/ring-certification/`)
- [ ] Staging + Production portal URLs set (same four endpoints)
- [ ] Marketing redeployed with Create Account–first link page + `#privacy-data`
- [ ] `ring-reviewer@rapidcortex.us` can sign in at `/test-agency/media`
- [ ] At least one linked device with **GPS** + **Enabled for Connect**
- [ ] Incident at that address returns the camera at 500m
- [ ] SMS Allow / Decline / Stop all open HTML confirmation pages
- [ ] Live stream opens; End Access works
- [ ] Legal URLs in Part 3 return HTTP 200
- [ ] Token Exchange + Account Link + Webhook registered (Part 1 Step 0)

GPS seed (if needed):

```bash
STAGE=dev AGENCY_ID=test-agency DEVICE_NAME_CONTAINS=Living \
  npx tsx scripts/seed-ring-sonoma-point-gps.ts
```

**SMS phone:** After linking, Rapid Cortex syncs the Ring profile phone onto the Cognito homeowner user when Ring returns it. If SMS still falls back to email, set Cognito `phone_number` (E.164) on the owner/reviewer path and re-test.
