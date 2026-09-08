# Rapid Cortex — Vertical Mass Notification + Bidirectional Physical Security
## Cursor Implementation Prompt
### Campus · Venue · Transit

**This is one product surface with two modules that share an orchestration layer:**

1. **Vertical Mass Notification (RC-MNS)** — one-click occupant/staff emergency broadcast from the operations console. Not the existing staff-only `VenueBroadcastModal` / campus notification / transit broadcast (those stay; they target authenticated security staff).
2. **Bidirectional physical security** — fire alarm + access control adapters. RC **receives** panel/door events and, only after human approval, **sends** commands (lock/unlock/grant/revoke/acknowledge). Same fail-closed pattern as CAD write-back.

Do **not** fork Call Assist, KCPD Lex, or PSAP dispatch. These verticals are not PSAPs. Emergencies still say “not 911 / hang up and dial 9-1-1.” RC does **not** control fire suppression hardware.

Drop this file in the repo root and implement in the phase order below. Scan first. Do not skip to SMS or door-lock write-back until the web dashboard channel and inbound event ingest work.

---

## HONEST CONSTRAINTS — READ BEFORE ANY CODE

### Mass notification is not “3-second SMS to 50,000 phones”

| Channel | Time to queue | Actual delivery | Notes |
|---|---|---|---|
| Web dashboard (WebSocket) | < 1 s | < 3 s | Genuine for **open console sessions** |
| Web push | < 2 s | < 5 s | Only browsers that granted permission |
| Email (SES) | < 3 s | 1–30 s | Recipient MTA dependent |
| SMS short code | < 3 s to Twilio | ~8–15 min for 50K | ~100 msg/s; 50K ÷ 100 ≈ 8 min |
| SMS 10DLC | < 3 s to queue | 30–90+ min / hours | **Forbidden for mass alerts** |

Product copy: **“message delivery initiated within 3 seconds.”** Never “received within 3 seconds” for SMS at scale. Delivery tracker must show: `ⓘ SMS delivery varies by carrier`.

### Recipient registry is the hard part

Campus security, venue security, and transit operators already have RC accounts. Occupants (students, guests, riders) generally do **not**. Without CSV/SIS import + TCPA consent, there is nobody to SMS/email.

Existing A2P 10DLC campaigns for **inbound** QR/SMS reporting are a **different use case**. Mass outbound emergency alerts need a separate campaign and almost certainly a **dedicated short code**.

RC **integrates alongside** Rave / Omnilert / Regroup — it does not replace them. Native registry is this prompt. A later “fire existing ENS via API” adapter is out of scope unless Phase 10 is reached.

### Bidirectional physical security is not “RC owns the FACP”

**Receive (inbound):** fire panel / ACS events → RC incident + map badge + optional staff broadcast.

**Send (outbound):** lock doors, grant temp access, revoke credential, acknowledge alarm in a **monitoring portal / BMS** — **never** trip sprinklers or silence a life-safety panel as a suppression command.

**Human approval is mandatory** for every outbound command, same as CAD write-back: proposed action → supervisor/admin approves → adapter sends → audit logs command, approver, vendor ACK/NACK.

Existing inbound stub (campus only, one-way): `POST /api/public/campus/{campusCode}/security-events` (`docs/product-architecture/CAMPUS_SECURITY_EVENTS.md`). Reuse signing (HMAC). Do not treat that as Genetec/Honeywell. It is a generic dump until native adapters exist.

CAD write-back stays fail-closed. Physical **command** write-back is a **new** fail-closed flag (`PHYSICAL_SECURITY_COMMANDS_ENABLED` / `NEXT_PUBLIC_ENABLE_PHYSICAL_SECURITY_COMMANDS`) default **OFF**. Event **ingest** defaults ON (like other operational flags).

---

## WHAT BIDIRECTIONAL FIRE ALARM + ACCESS CONTROL MEANS

Most integrations are one-way (RC only **reads**). Bidirectional means RC also **writes commands** after a human approves.

### Fire alarm — receive

Modern panels (Honeywell, JCI, Siemens, Bosch) expose BACnet/IP, REST, or webhooks:

- Which panel, zone, detector type (heat, smoke, pull station, sprinkler **flow indication**)
- Alarm clear / reset
- Trouble (low battery, comms fault)
- Manual pull location

### Fire alarm — send (allowed)

RC must **not** command suppression hardware. Allowed:

- Acknowledge receipt in an integrated BMS / monitoring portal
- Post “investigated — no fire” / false alarm to that portal
- Trigger **RC staff broadcast** (existing venue/campus/transit staff notify)
- Auto-create a vertical incident with zone pre-filled
- Correlate with open incidents in the same zone (e.g. fight in section 122 + pull 3 minutes later)

### Access control — receive

Lenel OnGuard, Software House C-CURE 9000, Genetec, Honeywell Pro-Watch, Avigilon:

- Door forced / held open
- Access denied; multiple failures
- After-hours valid access
- Tailgate (if vendor supports)
- Credential trail (doors + timestamps)

### Access control — send (approval-gated)

- Lock / unlock a door or zone
- Grant temporary access (duration + doors)
- Unlock evacuation path (e.g. stairwell override) — still not fire suppression
- Revoke a credential from the incident view
- Pull access history into the incident timeline

**RC can never autonomously lock a door.** Approval token is validated in the adapter, not only in the UI.

---

## HARD CONSTRAINTS

1. **Three verticals, one module.** Shared types/orchestration in `packages/shared` + `apps/api/src/alerts` + `apps/api/src/physical-security`. Vertical adapters only differ in location model, copy, recipient groups, and console routes.
2. **Do not mix verticals.** Campus job never broadcasts to venue WebSockets. `agencyId` on every Dynamo item. Organization grouping is **opt-in above** agencies (multi-campus / multi-venue) and still membership-checked against the caller’s `agencyId` (except `rcsuperadmin`).
3. **Reuse staff broadcast.** Occupant MNS is new. Do not replace `VenueBroadcastModal`, campus `postCampusNotification`, or transit `broadcast`.
4. **Never use 10DLC / `TWILIO_PHONE_NUMBER` / QR intake numbers for mass outbound SMS.** Short code from SSM: `ALERT_SHORT_CODE_SSM_PREFIX=/rc/alerts/short-code/{agencyId}` (or org id). If unset, SMS channel **skips** with `skipped` reason `NO_SHORT_CODE`.
5. **TCPA:** no SMS without `smsOptIn` + not `smsOptedOut`. DNC checked at **send time**, not only import. STOP/START webhook on the **short code**.
6. **CONFIRM** (case-insensitive) required client **and** server for occupant dispatch. Missing token → 400.
7. **Physical commands fail-closed.** No `approvalToken` → 403. Flag off → 403. Mock adapter for CI.
8. **No CAD, no PSAP, no CJIS on these verticals.** FERPA-sensitive campus recipient PII: minimize; do not log student IDs in CloudWatch.
9. **Feature flags default ON** for MNS UI/API (`ENABLE_VERTICAL_ALERTS` / `NEXT_PUBLIC_ENABLE_VERTICAL_ALERTS`). Physical **commands** default OFF. Ingest default ON.
10. Global feature rules: Zod in `packages/shared`, RBAC via `packages/security`, audit on mutations, `infra/template.yaml` (prefer a **nested** SAM stack, do not bloat `stack-app-sam.yaml`), Secrets Manager ARNs not raw keys, `sam validate --lint` after SAM edits.

---

## STEP 0 — REPOSITORY SCAN (MANDATORY)

Document file paths before code:

```
STAFF BROADCAST (keep; do not replace):
□ VenueBroadcastModal / NotifyStaffModal — apps/web/components/venue/venue-ops-modals.tsx
□ Campus notification — apps/api/src/handlers/campus/campus-dashboard-service.ts postCampusNotification
□ Transit broadcast — apps/web/components/transit/use-transit-ops-data.ts + /api/transit/{agencyId}/broadcast
□ BFF campus broadcast — apps/web/app/api/campus/[agencyId]/broadcast/route.ts

WEBSOCKET:
□ broadcastToAgency — apps/api/src/lib/websocket/send-message.ts
□ useAgencyWebSocket — apps/web/hooks/use-agency-websocket.ts
□ Campus/venue/transit dashboard WS consumers

INBOUND EVENTS (one-way stub):
□ docs/product-architecture/CAMPUS_SECURITY_EVENTS.md
□ POST /api/public/campus/{campusCode}/security-events

CAD FAIL-CLOSED PATTERN (copy for physical commands):
□ packages/shared CAD types / cad write-back gate
□ env.cadWritebackEnabled / NEXT_PUBLIC_ENABLE_CAD_WRITEBACK (default off)

CONSOLES + NAV (single source: apps/web/lib/navigation/role-nav.ts):
□ Campus: /app/campus/{code} — getCampusAdminNav / Supervisor / Security / Dispatch
□ Venue: /app/venue/{code} — getVenueAdminNav / Supervisor / Security (NOT guest services)
□ Transit: /app/transit/{admin|supervisor|security|operator} AND /transit/{code} — getTransitAdminNav
□ VENUE_GUEST_SERVICES: no MNS dispatch, no door lock. Keep “NOT A 911 EMERGENCY DISPATCH SYSTEM”

TWILIO / SES / AUDIT / ADDONS / FLAGS:
□ Twilio SMS providers — inbound reporting only for 10DLC
□ SES handlers / templates
□ packages/security AUDIT_EVENT_TYPES + AuthorizationService
□ packages/shared billing addon-catalog + ADDON_KEYS
□ apps/web/lib/runtime-flags.ts envFlag (default on)
□ apps/api/src/lib/env.ts featureEnabled
```

---

## MODULE A — VERTICAL MASS NOTIFICATION

### A.1 Shared types (`packages/shared/src/alerts/`)

Reuse the campus MNS models (`AlertOrganization`, `AlertRecipient`, `AlertRecipientGroup`, `AlertTemplate`, `AlertDispatchJob`, `AlertChannel`) with:

```typescript
export type AlertVertical = "campus" | "venue" | "transit";

export type AlertChannel = "SMS" | "EMAIL" | "WEB_DASHBOARD" | "WEB_PUSH";
```

Every org/job/template stores `vertical: AlertVertical`. Recipient groups are vertical-specific:

| Vertical | Default groups | Location language in templates |
|---|---|---|
| Campus | `all`, `faculty-staff`, `students`, `campus:{agencyId}`, `building:{id}` | `{{campusName}}`, building/zone |
| Venue | `all-staff` (RC users), `all-occupants` (imported), `section:{id}`, `gate:{id}` | `{{venueName}}`, section/gate |
| Transit | `all-operators`, `all-riders` (imported), `route:{id}`, `vehicle:{id}` | `{{agencyName}}`, route/stop/vehicle |

**Staff vs occupants:** Phase 4 web dashboard channel targets **logged-in console sessions** (staff). Occupant SMS/email requires registry (Phase 2). Venue guest-services role never dispatches occupant alerts.

### A.2 DynamoDB

Prefer **one** table `rapid-cortex-vertical-alerts-{stage}` (Call Assist / Field Command pattern) — PK `agencyId`, SK prefixes — **not** six root-stack tables. Condition `ExistingVerticalAlertsTableName` empty → create; else parameter workaround.

```
sk:
  ORG#{organizationId}
  GROUP#{groupId}
  TPL#{templateId}
  REC#{recipientId}
  JOB#{jobId}
  DNC#{e164}
  IMPORT#{importJobId}
  DELIVERY#{jobId}#{recipientId}#{channel}
gsi1: organizationId / sk  (multi-campus fan-out)
```

Every item includes `agencyId` **and** `organizationId`. Writes: `ConditionExpression` agency membership. Multi-agency org: recipient home campus `agencyId`; dispatch fans out WebSocket to `memberAgencyIds`.

### A.3 TCPA / import / opt-out

CSV columns as in the campus MNS spec. Phone E.164 required for SMS rows; `opt_in_date` + `opt_in_method` + `opt_in_consent_text` required if phone present. Duplicates update. Row failures do not fail the job. STOP/START on **short code** webhook `POST /api/alerts/sms/optout` (Twilio signature). Filter `smsOptedOut` / missing `smsOptIn` / DNC at send time; count `skipped` in summary.

### A.4 Templates

Seed system templates per vertical (copy differs; types shared):

`ACTIVE_THREAT | SHELTER_IN_PLACE | EVACUATION | LOCKDOWN | WEATHER_EMERGENCY | HEALTH_ALERT | INFRASTRUCTURE | ALL_CLEAR | CUSTOM`

Campus example SMS (≤160): armed threat at `{{campusName}}` — AVOID — 911 if in danger. **Never** “help is on the way” without a human.

Operators may edit body before send. Cannot change type/severity of system templates.

### A.5 Dispatch (two-click)

Step 1: template, groups, channels, estimated count, campus/venue/site list.  
Step 2: modal — type **CONFIRM** (case-insensitive). Server validates the same. Button disabled until match.

RBAC:

| Permission | Campus | Venue | Transit |
|---|---|---|---|
| `alerts.recipients.manage` | CAMPUS_ADMIN | VENUE_ADMIN | TRANSIT_ADMIN |
| `alerts.templates.manage` | CAMPUS_ADMIN | VENUE_ADMIN | TRANSIT_ADMIN |
| `alerts.dispatch` | CAMPUS_SUPERVISOR, CAMPUS_ADMIN | VENUE_SUPERVISOR, VENUE_ADMIN | TRANSIT_SUPERVISOR, TRANSIT_ADMIN |
| `alerts.dispatch.critical` | CAMPUS_ADMIN | VENUE_ADMIN | TRANSIT_ADMIN |
| `alerts.history.view` | supervisor/admin + analyst/auditor equivalents | same pattern | same |
| `alerts.organization.manage` | rcsuperadmin only | | |

CRITICAL cooldown 5 minutes (ALL_CLEAR exempt). Rate limit 3 occupant alerts / hour / org (configurable).

`POST /api/alerts/dispatch` returns `{ jobId, status: "DISPATCHING" }` immediately. Orchestrate async. Poll `GET /api/alerts/dispatch/{jobId}/status`.

### A.6 Channels

**Web dashboard (ship first):** `broadcastToAgency` for each `memberAgencyIds` with `type: "VERTICAL_ALERT"` (payload: jobId, vertical, title, body, severity, type, sentAt). Full-screen overlay; Acknowledge logged. Sub-3s for **open staff consoles**.

**Email:** SES bulk; mock if no credentials (`ALERT_SES_MOCK=1` or missing sender). Sender `alerts@alerts.rapidcortex.us`.

**Web push:** VAPID; `/sw.js` on campus/venue/transit portals only. 410 → drop subscription. Optional subset.

**SMS:** short code from SSM only. Batch; never 10DLC. If no short code, skip + UI note “Short code not provisioned (8–12 weeks). Delivery initiated only for other channels.”

Orchestration fans out with `Promise.all` — do not await channels sequentially.

### A.7 UI routes (feature `verticalAlerts`)

Add to `role-nav.ts` (omit when flag off). **Do not** add to VENUE_GUEST_SERVICES.

| Vertical | Dispatch | Recipients | Templates | Delivery |
|---|---|---|---|---|
| Campus | `/app/campus/{code}/alerts` | `.../alerts/recipients` | `.../alerts/templates` | `.../alerts/{jobId}` |
| Venue | `/app/venue/{code}/alerts` | same suffix | | |
| Transit | `/app/transit/{role}/alerts` **and** `/transit/{code}/alerts` | same | | |

Copy: “Delivery **initiated** within 3 seconds.” SMS bar always includes carrier caveat.

### A.8 Flags, billing, env

```
ENABLE_VERTICAL_ALERTS=true          # default on when unset
NEXT_PUBLIC_ENABLE_VERTICAL_ALERTS=1
Addon: vertical.alerts.module        # “Emergency Alert Broadcast” $500–$2000/mo by enrollment
Short code pass-through line item    # $500–$1000/mo — not the 10DLC inbound number
ALERT_SHORT_CODE_SSM_PREFIX=/rc/alerts/short-code/
ALERT_EMAIL_SENDER=alerts@alerts.rapidcortex.us
VAPID_* for web push
```

Nav key: `verticalAlerts`. Tests in `runtime-flags` confirming default-on.

---

## MODULE B — BIDIRECTIONAL PHYSICAL SECURITY

### B.1 Provider interface (`packages/shared` types + `apps/api/src/physical-security/`)

Follow CAD: engines never `switch` on vendor id. Register adapters.

```typescript
export type PhysicalSecurityProviderId =
  | "mock"
  | "genetec-security-center"
  | "honeywell-prowatch"
  | "generic-webhook"; // existing campus security-events ingest

export interface PhysicalSecurityProvider {
  getProviderInfo(): { id: PhysicalSecurityProviderId; name: string };

  // RECEIVE
  subscribeToFireAlarmEvents(agencyId: string, handler: (e: FireAlarmEvent) => void): Promise<void>;
  subscribeToAccessEvents(agencyId: string, handler: (e: AccessControlEvent) => void): Promise<void>;
  getAccessHistory(agencyId: string, credentialId: string, windowMinutes: number): Promise<AccessHistoryEntry[]>;

  // SEND — adapter MUST reject missing/invalid approvalToken
  lockDoors(agencyId: string, doorIds: string[], approvalToken: string): Promise<LockCommandResult>;
  unlockDoors(agencyId: string, doorIds: string[], approvalToken: string): Promise<UnlockCommandResult>;
  grantTemporaryAccess(
    agencyId: string,
    credentialId: string,
    doorIds: string[],
    durationMinutes: number,
    approvalToken: string,
  ): Promise<GrantResult>;
  revokeCredential(agencyId: string, credentialId: string, approvalToken: string): Promise<RevokeResult>;
  acknowledgeFireAlarm(agencyId: string, alarmId: string, resolution: FireAlarmResolution): Promise<void>;
}
```

First concrete adapters: **mock** (always), **generic-webhook** (map existing campus security-events), **Genetec Security Center** (REST), **Honeywell Pro-Watch**. Lenel / C-CURE later — same interface.

Secrets: Secrets Manager ARN per agency (`rapid-cortex/{stage}/physical-security/{agencyId}`), never Lambda env API keys.

### B.2 Ingest → incident correlation

On fire/access event:

1. Tenant-scope by `agencyId` / campusCode / venueCode / transit agency.
2. Create or attach vertical incident (campus/venue/transit tables already used by QR/SMS). Reuse campus security-events mapping where possible.
3. Badge the map/section/building/vehicle: `FIRE_ALARM` / `DOOR_FORCED` / `ACCESS_DENIED`.
4. Query open incidents in the same zone; if overlap, set `correlatedIncidentIds`.
5. Optional: staff-only broadcast (existing notify), **not** occupant MNS unless a human dispatches Module A.
6. Audit `PHYSICAL_EVENT_INGESTED`.

### B.3 Command API (fail-closed)

```
POST /api/physical-security/commands
Body: {
  agencyId, // from session, never URL as authority
  action: "LOCK_DOORS" | "UNLOCK_DOORS" | "GRANT_TEMP" | "REVOKE" | "ACK_FIRE",
  targetIds: string[],
  approvalToken: string,  // one-time token issued after supervisor confirm modal
  durationMinutes?: number,
  credentialId?: string,
  resolution?: FireAlarmResolution
}
```

Server:

1. Flag `PHYSICAL_SECURITY_COMMANDS_ENABLED` must be true.
2. Role: supervisor/admin for that vertical (`physical.command.approve`).
3. Consume single-use `approvalToken` (issued by `POST /api/physical-security/commands/propose`).
4. Adapter send; store vendor request/response **without** secrets.
5. Audit `PHYSICAL_COMMAND_PROPOSED`, `PHYSICAL_COMMAND_APPROVED`, `PHYSICAL_COMMAND_SENT`, `PHYSICAL_COMMAND_ACK` / `_NACK`.

UI: incident or zone panel shows **proposed** lockdown; “Approve and send” disabled until typed **APPROVE** (or reuse CONFIRM). Guest services: **no** command UI.

### B.4 Vertical UX

- **Campus:** chemistry-building QR report → incident shows 3 badge denials at east entrance (access history pull, read-only, no command until approve).
- **Venue:** Section 122 fights → CRITICAL → supervisor proposes lock Gate 12 → approve → Genetec lock → section view updates.
- **Transit:** yard/gate ACS + station FACP; same adapter; location = stop/yard/vehicle.

### B.5 Flags

```
ENABLE_PHYSICAL_SECURITY_INGEST     # default on when unset
NEXT_PUBLIC_ENABLE_PHYSICAL_SECURITY_INGEST
PHYSICAL_SECURITY_COMMANDS_ENABLED  # default OFF (like CAD write-back)
NEXT_PUBLIC_ENABLE_PHYSICAL_SECURITY_COMMANDS  # default off
```

Addon: `physical.security.module`. Commands also require signed vendor addendum (document in onboarding; do not enable in `deploy.sh` prod until go/no-go — same spirit as CAD write-back).

---

## API SURFACE (combined)

```
# MNS
GET/POST/PATCH /api/alerts/organizations...
POST /api/alerts/recipients/import
GET  /api/alerts/recipients/import/{jobId}
GET/DELETE /api/alerts/recipients...
GET/POST/PATCH/DELETE /api/alerts/groups...
GET/POST/PATCH/DELETE /api/alerts/templates...
POST /api/alerts/dispatch
GET  /api/alerts/dispatch
GET  /api/alerts/dispatch/{jobId}
GET  /api/alerts/dispatch/{jobId}/status
GET  /api/alerts/dispatch/{jobId}/log
POST /api/alerts/sms/optout              # Twilio sig; short code only
POST /api/alerts/sms/delivery-status

# Physical
POST /api/physical-security/events       # vendor webhook (HMAC) — or reuse campus public route with vertical param
POST /api/physical-security/commands/propose
POST /api/physical-security/commands
GET  /api/physical-security/access-history?credentialId=&windowMinutes=
GET  /api/physical-security/status       # door/zone cache for map badges
```

BFF: `apps/web/app/api/alerts/[...path]/route.ts` and `.../physical-security/[...path]/route.ts` → stack HttpApi (prefer nested stack on stack 1 or 2 with campus/venue/transit). JWT on all except Twilio + vendor HMAC webhooks.

---

## IMPLEMENTATION PHASES (do not skip)

**Phase 1 — Data layer.** Shared types, Zod, single Dynamo table + Existing* param, permissions, audit event names, flags, addons. Zero user-facing. Tests: RBAC deny for guest services / dispatcher; flag default-on for MNS; commands default-off.

**Phase 2 — Recipient registry.** CSV import job, groups, DNC, STOP webhook (no mass send yet). Admin UI per vertical.

**Phase 3 — Templates.** Seed per vertical. Character counters. Preview with `{{campusName}}` / `{{venueName}}`.

**Phase 4 — Dispatch console + WebSocket only.** CONFIRM modal. Overlay on campus, venue, transit consoles. Tracker shows web dashboard complete; SMS/email/push `skipped` or `queued` with honest copy. **Demo: one CONFIRM reaches all open consoles on member agencies in < 3 s.**

**Phase 5 — Email.** SES or mock.

**Phase 6 — Web push.** `apps/web/public/sw.js`, opt-in banner, VAPID.

**Phase 7 — SMS short code.** Runbook: 8–12 week procurement. SSM per org. Never 10DLC. DLR webhook.

**Phase 8 — Multi-site org.** AlertOrganization membership; recipient dedupe by phone/email; WS fan-out.

**Phase 9 — Delivery tracker polish.** Progress bars, export, All-Clear CTA.

**Phase 10 — Physical ingest.** Generic webhook + mock Genetec/Honeywell. Incident create + correlation + map badge. Extend campus security-events to venue/transit codes.

**Phase 11 — Physical commands.** Propose/approve token, fail-closed flag, mock adapter that records commands. Real Genetec/Honeywell only behind secrets + flag. No fire suppression APIs.

---

## CURSOR MASTER INSTRUCTION

> You are implementing **Vertical Mass Notification** and **bidirectional fire/access-control** for RC Campus, RC Venue, and RC Transit as one module with vertical adapters.
>
> **Do not start with code.** Complete Step 0 scan with file paths.
>
> **Phase 4 before SMS. Phase 10 ingest before Phase 11 commands.** Web dashboard channel is the only sub-3-second occupant/staff path you can demo without a short code.
>
> **Never use inbound 10DLC numbers for mass SMS.** Short code from SSM or skip the channel.
>
> **TCPA is law.** Filter opted-out / missing consent at send time.
>
> **CONFIRM** on occupant dispatch; **approvalToken** on physical commands. Enforce server-side.
>
> **Copy:** initiated within 3 seconds; SMS varies by carrier.
>
> **CAD write-back stays fail-closed.** Physical commands are a separate fail-closed flag, default off.
>
> **VENUE_GUEST_SERVICES** gets neither dispatch nor door lock. Keep the not-911 banner.
>
> After each phase: files, tables, env, routes, manual steps (short code, vendor addendum), tests passing. Do not break existing RC tests.
>
> *Rapid Cortex — Intelligence at the speed of response. RC enhances operations; it does not replace CAD, FACP life-safety, or 911.*
