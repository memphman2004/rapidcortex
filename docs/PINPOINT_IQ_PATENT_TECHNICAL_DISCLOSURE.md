# PINPOINT_IQ_PATENT_TECHNICAL_DISCLOSURE.md

**Product:** NexCort iQ — NexiQ Pinpoint (also referred to in UI/docs as LiveLocation / Pinpoint iQ)  
**Document type:** Technical invention disclosure (implementation inventory)  
**Scope:** Codebase review of existing Pinpoint and related campus location-sharing paths  
**Date of inspection:** 2026-10-14  
**Constraint:** Documentation only. No code was modified, deployed, or refactored for this document.

---

## Disclaimer

This document describes **what the current NexCort iQ codebase implements**, based on source inspection. It does **not** assert that any mechanism is novel, non-obvious, or patentable. Any claim of patentability requires independent prior-art search and counsel review. Credentials, production secrets, and real incident data are omitted.

---

## 1. Executive summary

NexCort iQ Pinpoint provides **time-bounded, opaque-token-gated GPS location sharing** tied to an incident. Two primary channel modes share one DynamoDB model (`PinpointLinksTable`):

| Channel | How the reporter gets the token | SMS? |
|--------|----------------------------------|------|
| `sms` (default create path) | Dispatcher creates a link; SMS contains `/pinpoint/t/{token}` | Yes |
| `browser` (QR / public intake) | Campus QR report with `shareLiveLocation`; token returned in HTTP response; client streams GPS immediately | No |

A **separate** campus/venue path (`SmsLocationService` + `/locate/{token}`) uses a different token table and ULID tokens. That path is related product functionality but is **not** the same Pinpoint link model.

---

## 2. Implemented vs planned / partial

### 2.1 Implemented (present in code)

| Capability | Primary locations |
|-----------|-------------------|
| Opaque Pinpoint token generation (32-byte `base64url`) | `apps/api/src/services/pinpointService.ts` — `newOpaqueToken()` |
| Token stored only as SHA-256 hash | `hashToken()`; `PinpointLinkRepository.getByTokenHash` |
| DynamoDB persistence + TTL | `infra/nested/stack-data-layer.yaml` — `PinpointLinksTable`; `pinpointLinkRepository.ts` |
| SMS-channel link create + send | `PinpointService.createLink` |
| Browser-channel link create without SMS | `PinpointService.createInlineQrShare` |
| Public GET session + POST location | `apps/api/src/handlers/pinpointPublicHttp.ts` |
| Web BFF proxy for public Pinpoint | `apps/web/app/api/public/pinpoint/[token]/[[...segments]]/route.ts` |
| Caller browser GPS client | `apps/web/components/pinpoint/pinpoint-caller-client.tsx` |
| Campus QR inline GPS after report | `apps/web/components/qr-nfc/campus-live-location-share.tsx` |
| QR/NFC public report → campus incident → optional Pinpoint | `publicReportSubmitHttp.ts`, `qr-nfc-incident-service.ts`, `QRIntakeClient.tsx` / `qr-nfc-intake-client.tsx` |
| RCLI location intake (`POST /api/r/{rcli}`) with optional live share | `locationIntakeHttp.ts` |
| Dispatcher Pinpoint panel (SMS create + revoke + live map) | `apps/web/components/dispatch/pinpoint-panel.tsx`, `pinpoint-dispatcher-live.tsx` |
| Campus ops card: QR place label + live-only Pinpoint panel | `CampusIncidentCard.tsx` (`PinpointPanel` `liveOnly`) |
| Accuracy / confidence helpers | `packages/shared/src/pinpoint-surge/location-utils.ts`, `apps/api/src/lib/location-confidence.ts` |
| Zod schemas / config constants | `packages/shared/src/pinpoint-surge/schemas.ts`, `constants.ts` |
| Feature flag | `ENABLE_PINPOINT` via `env.enablePinpoint` |
| Audit events on generate / revoke / capture | `AUDIT_EVENT_TYPES.PINPOINT_*` in `pinpointService.ts` |
| Alternate SMS locate path (ULID tokens) | `smsLocationService.ts`, `packages/shared/src/sms-location/*`, campus `SmsLocationPanel` |

### 2.2 Planned, partial, or schema-only

| Item | Status in codebase |
|------|-------------------|
| `createBrowserPinpointLinkBodySchema` (`channel: "browser"`) | Defined in shared schemas; **browser creation is implemented via `createInlineQrShare`**, not a separate authenticated “create browser link” HTTP route mirroring the SMS create body. |
| Caller “Stop sharing” as server revoke | **Client-only** (`clearWatch`). Does **not** call `POST .../pinpoint/links/{linkId}/revoke`. Token remains valid until expiry or operator revoke. |
| Explicit “stale position” state machine | **Not** a first-class server status. UI shows last `capturedAt`; session has `active` / `revoked` / `expired`. |
| Photo/video on campus safety `ReportForm` | UI controls marked “Coming soon” / disabled. |
| Dispatcher help article (`apps/web/public/help/dispatcher/pinpoint.md`) | Still largely SMS-centric; campus browser path is newer and documented mainly in product UI copy. |
| Backend enforcement that `consentGrantedAt` must be present before GPS accept | Consent is **recorded** on browser create; `captureLocation` validates token/status/expiry/accuracy/rate-limit, **not** a separate consent flag check. |

---

## 3. Opaque tracking token: generation, security, mapping, validation

### 3.1 Generation

```text
newOpaqueToken():
  token ← base64url(randomBytes(32))   // ~43 chars, URL-safe
  tokenHash ← SHA-256(token) as hex
  linkId ← makeId("ppl")
```

Functions: `newOpaqueToken`, `hashToken` in `apps/api/src/services/pinpointService.ts`.

### 3.2 Security properties (as implemented)

1. **Opaque bearer token** — no incident id, agency id, or phone embedded in the token string.
2. **At-rest hash only** — DynamoDB stores `tokenHash`, not the plaintext token. Lookup uses GSI `tokenHash-linkId-index`.
3. **Public path shape validation** — `isLikelyPublicAccessToken` (`apps/api/src/lib/publicToken.ts`) requires `^[A-Za-z0-9_-]{16,256}$` before service calls.
4. **Time bound** — `expiresAt = now + PINPOINT_CONFIG.LINK_EXPIRY_MINUTES` (30 minutes). DynamoDB `ttl` = expiry epoch + 1 hour for cleanup.
5. **Rate limits on create (SMS path)** — max `PINPOINT_CONFIG.MAX_LINKS_PER_HOUR` (100) active creates per incident in the last hour.
6. **No JWT / Cognito** on public Pinpoint routes — authorization is possession of the token + link status.

### 3.3 Mapping to an incident

`PinpointLinkDdbItem` (`pinpointLinkRepository.ts`):

| Field | Role |
|-------|------|
| `linkId` | PK |
| `tokenHash` | GSI hash for public lookup |
| `agencyId` | Tenant scope |
| `incidentId` | Incident binding |
| `status` | `active` \| `revoked` \| `expired` |
| `expiresAt` | Soft expiry |
| `pings[]` | Appended GPS updates |
| `channel` | Optional `browser` \| `sms` |
| `consentGrantedAt` | Browser opt-in timestamp |
| `callerPhoneE164` | Optional callback (SMS path required; browser optional/validated) |
| `ttl` | DynamoDB TTL |

### 3.4 Validation (public API)

```text
GET /api/pinpoint/t/{token}  or  POST .../location
  if not isLikelyPublicAccessToken(token) → 404
  row ← getByTokenHash(SHA256(token))
  if missing → 404
  if status = revoked → 404
  if now > expiresAt → mark expired, → 410 link_expired
  else proceed (GET returns public view; POST appends ping)
```

Handler: `apps/api/src/handlers/pinpointPublicHttp.ts` → `PinpointService.getPublicByToken` / `captureLocation`.

Public view intentionally returns `linkId`, `incidentId`, `status`, `expiresAt`, `pings` (not phone).

---

## 4. Public report → authorized tracking session without SMS

### 4.1 End-to-end (campus QR / NFC — primary no-SMS path)

```text
1. Visitor scans campus QR/NFC → public report UI
   apps/web/components/qr-nfc/qr-nfc-intake-client.tsx
   (also QRLocations intake: QRIntakeClient.tsx → POST /api/r/{rcli})

2. Optional checkbox: shareLiveLocation (unchecked by default)
   ReportForm.tsx — "Share my location until help arrives"
   Phone required when shareLiveLocation is true (campus)

3. POST /api/public/report  (QrNfcRepository + createIncidentFromQrNfcReport)
   or POST /api/r/{rcli}    (QRLocationsRepository + createCampusQrIncident)

4. Campus incident created with place metadata from the QR record:
   building / floor / zone / qrRcli / qrLocationName
   (qr-nfc-incident-service.ts → createCampusQrIncident)

5. If shareLiveLocation && campus:
   PinpointService.createInlineQrShare({
     agencyId, incidentId, rcli, callerPhoneE164?, consentGrantedAt
   })
   → channel: "browser", smsSentAt: null, no SMS send

6. Response includes trackingToken / liveLocationToken (plaintext, once)

7. Client starts Geolocation watch and POSTs to
   /api/public/pinpoint/{token}/location
   CampusLiveLocationShare.tsx (auto-start after consent on form)
```

### 4.2 Contrast with SMS Pinpoint

Dispatcher path (`PinpointPanel` without `liveOnly`):

```text
POST /api/incidents/{id}/pinpoint/links
  body: { callerPhoneE164 }
  → createLink → SMS with public URL → same PinpointLinks table
```

Handler: `apps/api/src/handlers/pinpointSurgeIncidentsHttp.ts`.

### 4.3 “Authorized” meaning in this design

There is no separate OAuth session for the reporter. **Authorization to stream GPS** means:

1. An active Pinpoint link row exists for the incident.
2. The client presents the correct opaque token.
3. Link is not revoked/expired.
4. Capture payload passes Zod + accuracy + rate-limit checks.

---

## 5. Consent: record, revoke, enforce

### 5.1 Recording

| Path | How consent is expressed | Persistence |
|------|--------------------------|-------------|
| Campus QR report | Explicit checkbox `shareLiveLocation` + required phone | `consentGrantedAt` on link; audit `PINPOINT_LINK_GENERATED` with `channel: browser`, `source: qr_inline` |
| RCLI intake | `shareLiveLocation` on `qrPublicIntakeSchema` | `createInlineQrShare` (consent timestamp defaulted to create time if not passed) |
| SMS Pinpoint | Implicit: dispatcher sends link; reporter must open page and tap “Share my location” (browser permission) | Link created without `channel: browser`; `smsSentAt` set when SMS sends |

Checkbox copy (campus): optional; location shared with campus safety; keep screen open (`ReportForm.tsx`).

### 5.2 Revocation

| Actor | Mechanism | Effect |
|-------|-----------|--------|
| Dispatcher / campus ops | `POST /api/incidents/{id}/pinpoint/links/{linkId}/revoke` → `PinpointService.revokeLink` | `status=revoked`, `revokedAt` set; subsequent public GET/POST → 404 |
| Reporter “Stop sharing” | `navigator.geolocation.clearWatch` only | Stops uploads from that browser; **does not** revoke the server link |
| Time | `expiresAt` / TTL | Status flipped to `expired` on next access; DynamoDB TTL deletes row later |

### 5.3 Backend enforcement

`captureLocation` enforces:

- Token hash lookup  
- Not revoked  
- Not past `expiresAt`  
- Zod lat/lng/accuracy/heading/speed bounds (`pinpointLocationCaptureBodySchema`)  
- Accuracy within `[MIN_ACCURACY_METERS, MAX_ACCURACY_METERS]` when provided (5–1000 m)  
- Min interval between pings (`LOCATION_UPDATE_RATE_LIMIT_SECONDS` = 1)

It does **not** re-check a live “consent still true” boolean beyond link status. Consent at creation + token possession + active status is the enforcement model as coded.

---

## 6. GPS updates: validation, timestamping, storage, display

### 6.1 Client capture

Both `PinpointCallerClient` and `CampusLiveLocationShare` use the **W3C Geolocation API**:

- `enableHighAccuracy: true`
- Fields posted: `lat`, `lng`, `accuracyM`, optional `headingDeg`, `speedMps`
- Caller page also throttles sends client-side every 4s (`STREAM_INTERVAL_MS`); campus share relies more on server 1s rate limit (`maximumAge: 5000` on watch)

### 6.2 Server timestamping

Server sets `capturedAt = new Date().toISOString()` at accept time (not client clock). Ping appended to `pings` array; retained last **80** pings (`.slice(-80)`).

### 6.3 Storage

`PinpointLinkDdbItem.pings: PinpointPing[]` on the same link item (`PutCommand` overwrite). Audit: `PINPOINT_LOCATION_CAPTURED` with classified confidence.

### 6.4 Display (ops)

- **PSAP / general:** `PinpointPanel` + `PinpointDispatcherLive` — map marker, confidence badge, movement label, timeline (`pinpoint-location-timeline.tsx`), poll ~5s  
- **Campus:** `CampusIncidentCard` embeds `PinpointPanel` with `liveOnly` (no SMS create UI)  
- **Venue:** `venue-incident-ops-detail-client.tsx` similarly uses `liveOnly`  
- Confidence: ≤25 m high, ≤100 m medium, else low (`calculateLocationConfidence` / `classifyLocationConfidence`)

---

## 7. Expired sessions, stale positions, original QR scan location

### 7.1 Expired sessions

- Soft expiry: `expiresAt`  
- On public access after expiry: status → `expired`, HTTP **410** `link_expired`  
- Hard cleanup: DynamoDB TTL on `ttl` attribute  

### 7.2 Stale positions

No dedicated `stale` enum on pings. Operators infer freshness from:

- Latest `capturedAt` / “Updated …” UI  
- Timeline deltas (meters / seconds between pings)  
- Link `status` (active but no recent pings = waiting)  

Client “Stop sharing” can leave an **active** link with a **last known** ping that ages without further updates.

### 7.3 Original QR scan location vs live GPS

These are **distinct data planes**:

| Layer | What it represents | Where stored / shown |
|-------|--------------------|----------------------|
| QR place of report | Fixed facility place: building, floor, zone, RCLI, `qrLocationName` | Campus incident fields; `QrIncidentLocation` on `CampusIncidentCard` |
| Optional one-shot lat/lng at intake | Browser coords on some intake payloads (`payload.lat` / `lng` in `locationIntakeHttp`) | May seed campus `locationData` at create |
| Pinpoint live trail | Moving device GPS under opaque token | `PinpointLinks.pings`; Pinpoint panel map/timeline |
| SMS locate alternate | GPS/cell/manual entries on campus incident | `incident.locationData` + `SmsLocationPanel` |

Operators can therefore compare **where the QR was scanned/posted** vs **where the phone later reports**.

---

## 8. Technical mechanisms vs conventional browser geolocation + incident reporting

The following are **architectural choices in this codebase**, not claims of novelty:

1. **Incident-bound opaque token with hashed persistence** — public GPS API does not accept raw incident ids; mapping is hash → link → `agencyId`/`incidentId`.  
2. **Dual channel on one table** — SMS-delivered links and in-browser QR continuation share the same Pinpoint model (`channel`, `consentGrantedAt`, `smsSentAt`).  
3. **QR intake creates the incident and optionally mints the tracking session in one transaction boundary** (create incident, then non-fatal Pinpoint create).  
4. **Separation of place-of-QR vs stream-of-device** — facility metadata vs ping history.  
5. **Server-side accuracy gates and rate limits** on public POST, plus confidence classification for ops UI.  
6. **Tenant-scoped ops reads** — list/get/revoke require authenticated user + agency match (or PSAP incident access via `resolveIncidentRead` / `TenantAccessGuard`).  
7. **Audit trail** for generate / revoke / capture events.  
8. **Feature-flagged** (`ENABLE_PINPOINT`) with fail-soft QR intake when Pinpoint is off (`createInlineQrShare` returns `null`).

Conventional browser geolocation alone does not define token hashing, incident binding, multi-channel link lifecycle, or ops revoke; those are product-layer constructs around the browser API.

---

## 9. Alternative implementations supported by the current architecture

| Alternative | Mechanism | Notes |
|-------------|-----------|-------|
| **A. Dispatcher SMS Pinpoint** | `createLink` + SMS provider factory | Classic PSAP assistive GPS |
| **B. Browser Pinpoint after QR** | `createInlineQrShare` + `CampusLiveLocationShare` / success-screen auto-start | No SMS; token in JSON response |
| **C. RCLI QRLocations intake** | `POST /api/r/{rcli}` + `maybeCreateLiveShare` | Parallel intake to QrNfc public report |
| **D. QrNfc public report API** | `POST /api/public/report` | Vertical-aware incident factories (campus/venue/transit/911) |
| **E. SMS Location (Locate) service** | `SmsLocationService`, ULID token as PK, `/locate/{token}`, campus `locationData` | Separate table/model; phone stored as **hash**; statuses `PENDING`/`RECEIVED`/`DENIED`/`EXPIRED` |
| **F. Cell-tower / manual campus locations** | `applyCarrierLocation`, locate submit sources | Complements GPS on campus SMS path |
| **G. Relative public base URL** | If `PINPOINT_PUBLIC_BASE_URL` unset, browser share may return path-only `/pinpoint/t/...` | Absolute URL preferred for SMS |
| **H. Mock SMS** | `PINPOINT_SMS_MOCK` / locate mock flags | Non-prod send path |

Surge clustering (`packages/shared/src/pinpoint-surge/surge-*`, `pinpointSurgeIncidentsHttp.ts`) is packaged alongside Pinpoint but is a **duplicate-call clustering** feature, not required for token GPS streaming.

---

## 10. Key file and function index

### Shared

- `packages/shared/src/pinpoint-surge/constants.ts` — `PINPOINT_CONFIG`  
- `packages/shared/src/pinpoint-surge/schemas.ts` — create/capture schemas, public/dispatcher view types  
- `packages/shared/src/pinpoint-surge/location-utils.ts` — confidence, heading, distance  
- `packages/shared/src/qr-nfc/schemas.ts` — `publicReportSubmitSchema.shareLiveLocation`  
- `packages/shared/src/sms-location/*` — alternate locate token types/schemas  

### API

- `apps/api/src/services/pinpointService.ts` — `createLink`, `createInlineQrShare`, `captureLocation`, `revokeLink`, `getPublicByToken`  
- `apps/api/src/repositories/pinpointLinkRepository.ts` — DDB access  
- `apps/api/src/handlers/pinpointPublicHttp.ts` — public routes  
- `apps/api/src/handlers/pinpointSurgeIncidentsHttp.ts` — authenticated incident Pinpoint routes  
- `apps/api/src/handlers/qr-nfc/publicReportSubmitHttp.ts` — QR report + inline share  
- `apps/api/src/handlers/locations/locationIntakeHttp.ts` — RCLI intake + live share  
- `apps/api/src/qr-nfc/qr-nfc-incident-service.ts` — `createIncidentFromQrNfcReport`  
- `apps/api/src/services/smsLocationService.ts` — alternate SMS locate  
- `apps/api/src/lib/publicToken.ts` — token shape gate  
- `apps/api/src/lib/location-confidence.ts` — server confidence  

### Web

- `apps/web/app/pinpoint/t/[token]/page.tsx` — public SMS/link landing  
- `apps/web/components/pinpoint/pinpoint-caller-client.tsx` — SMS-link GPS UI  
- `apps/web/components/qr-nfc/campus-live-location-share.tsx` — post-report GPS  
- `apps/web/components/qr-nfc/qr-nfc-intake-client.tsx` / `ReportForm.tsx` — consent checkbox  
- `apps/web/components/intake/QRIntakeClient.tsx` — RCLI intake + share  
- `apps/web/components/dispatch/pinpoint-panel.tsx` — ops control  
- `apps/web/components/dispatch/campus/CampusIncidentCard.tsx` — campus dashboard integration  
- `apps/web/components/dispatch/campus/sms-location-panel.tsx` — alternate locate UI  

### Infrastructure

- `infra/nested/stack-data-layer.yaml` — `PinpointLinksTable` (PK `linkId`, GSI `tokenHash-linkId-index`, GSI `incidentId-createdAt-index`, TTL)  
- `infra/nested/stack-app-sam-5.yaml` / `stack-app-sam-qr.yaml` — Lambda env `PINPOINT_LINKS_TABLE`, IAM  

---

## 11. Pseudocode — browser Pinpoint after campus QR (no SMS)

```text
function campusQrReportWithLiveShare(form):
  require form.shareLiveLocation ⇒ form.reporterPhone
  record ← loadActiveQr(form.qrId)
  incidentId ← createCampusQrIncident(record, form)   // place = QR metadata

  if form.shareLiveLocation:
    token ← randomBytes(32).base64url()
    put PinpointLink {
      tokenHash: sha256(token),
      agencyId, incidentId,
      status: active,
      channel: browser,
      consentGrantedAt: now,
      expiresAt: now + 30m,
      pings: []
    }
    return { incidentId, trackingToken: token }   // plaintext once

  return { incidentId }

function browserStream(token):
  watchPosition(highAccuracy):
    POST /api/pinpoint/t/{token}/location { lat, lng, accuracyM, ... }
    server: validate hash, status, expiry, rate, accuracy
            append ping with server capturedAt
```

---

## 12. Configuration surface (names only)

Environment / flags referenced by implementation (values not reproduced):

- `ENABLE_PINPOINT`  
- `PINPOINT_LINKS_TABLE`  
- `PINPOINT_PUBLIC_BASE_URL`  
- `PINPOINT_SMS_MOCK`  
- Related locate path: `ENABLE_SMS_LOCATION`, location tokens table, locate public base URL  

---

## 13. Suggested prior-art diligence topics (non-exhaustive)

For counsel / prior-art search only — **not** findings of novelty:

- Emergency SMS deep links for device location  
- Hashed bearer tokens for public location upload  
- QR-code emergency reporting with facility place codes  
- Browser Geolocation streaming to CAD/security consoles  
- Separate static place-of-scan vs dynamic device track  

---

## 14. Document control

| Field | Value |
|-------|--------|
| Authoring mode | Automated codebase inspection for patent documentation support |
| Code changes | None |
| Deploys | None |
| Assertions of patentability | None |

*End of disclosure.*
