# NexCort iQ K–12 — Emergency Operations

**Product:** NexCort iQ Campus (K–12)  
**Last updated:** November 2026

---

## Overview

Emergency operations covers everything from a single-classroom wellness check to a district-wide lockdown. NexCort iQ K–12 provides the **coordination and communication layer** — it does not replace 911, school police radio, or the principal's judgment. All life-safety decisions remain with human responders.

---

## Standard Operating Position

> NexCort iQ Campus is a safety coordination and intake platform. It is **not a 911 system**, not a CAD, and not a replacement for trained school safety personnel. When in doubt, call 911 first.

The `CampusK12Banner` component (`apps/web/components/campus/k12/CampusK12Banner.tsx`) displays this on every campus page:  
**"K-12 — District console — this is NOT a 911 emergency dispatch system"**

---

## Emergency Protocols in Scope

NexCort iQ K–12 supports the standard CISA school emergency protocol language:

| Protocol | Meaning | NexCort iQ action |
|----------|---------|-------------------|
| **LOCKDOWN** | Threat inside building; secure-in-place | Silent panic → incident created → EAP matched → broadcast to staff |
| **SECURE** | Threat outside building; classes continue | Threat level set to `elevated`; broadcast to staff |
| **EVACUATE** | Leave building immediately | Broadcast; incident created; reunification not yet built |
| **SHELTER** | Hazard requires in-place shelter (tornado, gas) | Broadcast; incident created |
| **HOLD** | Hallway clear needed | Broadcast to staff only |

---

## Implemented Emergency Features

### 1. Silent Panic

**What it does:** Allows a staff member to silently activate a panic response without audible alarm, calling attention to themselves, or alerting an intruder.

**Files:**
- Schema: `packages/shared/src/campus/silent-panic.ts`
- Component: `apps/web/components/campus/k12/SilentPanicPanel.tsx`
- API: Part of `PostCampusIncidentFunction` with `silentPanic: true` flag

**Activation flow:**
1. Staff presses hidden button in campus console (SilentPanicPanel)
2. Selects building, floor, and site (required)
3. Optionally adds brief description
4. `POST /api/campus/incidents` with `{ silentPanic: true, type: "active_threat", buildingCode, siteCode }`
5. Incident created as `active_threat` with `source: "silent_panic"`, highest priority
6. Dispatch queue lights up; staff with notification permissions receive broadcast

**Capability declarations** (`SILENT_PANIC_PRODUCT_DOES`, `SILENT_PANIC_DISTRICT_OWNS`):
- **Product does:** Create incident, notify dispatch, display location context, attach EAP
- **District owns:** Radio protocols to field units, 911 call, public address, actual lockdown procedures

**RBAC:** Admin, supervisor, security, dispatch roles can activate. Faculty and counselor cannot.

---

### 2. Threat Level Management

**What it does:** Allows campus safety leadership to set a school-wide or district-wide threat condition, visible to all campus staff.

**Routes:**
- `GET /api/campus/{agencyId}/threat-level` — current threat level
- `PATCH /api/campus/{agencyId}/threat-level` — update threat level

**Levels:** `clear` | `elevated` | `active` | `lockdown`

**Function:** `PatchCampusThreatLevelFunction`

**Stored in:** `CAMPUS_CONFIG_TABLE` under `CAMPUS#{campusCode}#THREAT`

---

### 3. District Schools Panel

**What it does:** Shows all schools in a district with their current alert status and active incident counts at a glance.

**Component:** `apps/web/components/campus/k12/DistrictSchoolsPanel.tsx`

**Data source:** `GET /api/campus/{agencyId}/sites` → returns `CampusSite[]` with `alertStatus` and `activeIncidentCount` per site

**Alert status levels:** `clear` | `active` | `elevated` | `lockdown` (from `district-school.ts`)

**Grade level badges:** HS, MS, ES, K-8, PK-12 (from `CAMPUS_GRADE_LEVELS`)

**Current limitation:** Threat level affects one campus tenant at a time. No single API call sets all schools in a district to `lockdown` simultaneously. Each `agencyId` (school) must be updated individually.

---

### 4. Emergency Action Plans (EAP)

**What it does:** Pre-configured step-by-step response checklists for specific incident types at specific buildings. Automatically surfaced when an incident is created.

**Files:**
- Schema: `packages/shared/src/campus/eap-schemas.ts`
- Service: `apps/api/src/campus/campus-eap-service.ts`
- Routes: `GET/POST/DELETE /api/campus/eap`, `GET /api/campus/eap/match`

**EAP structure:**
```typescript
{
  eapId: string,
  campusCode: string,
  title: string,              // e.g., "Active Threat — Main Building"
  buildingCode: string,       // Which building, or "*" for all
  incidentTypes: string[],    // Which incident types trigger this EAP
  steps: string[],            // Step-by-step response actions
  documentUrl?: string,       // Optional link to full SOP document
  active: boolean
}
```

**Auto-matching:** When an incident is created, `GET /api/campus/eap/match?campusCode=&buildingCode=&type=` returns the best-matching EAP checklist. The EAP checklist is embedded in the incident record and after-action PDF.

**Frontend:** `/app/campus/[campusCode]/eap/page.tsx`

---

### 5. Broadcast Notifications

**What it does:** Send an urgent message to all on-duty campus staff via the platform.

**Route:** `POST /api/campus/{agencyId}/broadcast`  
**Function:** `PostCampusBroadcastFunction`  
**Auth:** Admin, supervisor, dispatch roles

**Note:** This is an **in-platform broadcast** to logged-in staff, not mass SMS to students/parents. Campus mass SMS to students is a separate `campus-alerts` feature that is currently **higher-ed only** per product policy.

---

### 6. Bluelight Pole Network

**What it does:** Monitors and activates emergency blue-light poles installed across campus.

**Routes:**
- `GET /api/campus/bluelight/poles` — pole registry with status
- `POST /api/campus/bluelight/activate` — activate one or all poles

**Function:** `BlueLightGetPolesFunction`, `BlueLightActivateFunction`

**Integration:** Bluelight poles connect via the security event webhook or direct API call. The `BlueLightApiKeySecretArn` parameter stores the pole network API key.

---

### 7. War Rooms (Collaborative Command)

**What it does:** Real-time collaborative workspace for multi-party incident command during major events.

**Route:** `/app/campus/[campusCode]/war-rooms`  
**Feature flag:** `isWarRoomsEnabled()` from `runtime-flags.ts`  
**Component:** `CampusWarRoomsClient`

---

### 8. Security Event Integration

**What it does:** Receives automated alerts from campus security systems (access control, ALPR, motion sensors) and creates incidents automatically.

**Route:** `POST /api/public/campus/{campusCode}/security-events`  
**Schema:** `campusSecurityEventBodySchema` — source, type, severity, location  
**Function:** `PostCampusSecurityEventFunction`

Incoming events are mapped to K-12 incident types via `mapSecurityEventTypeToIncidentType()`.

---

## Missing Emergency Features (Phase 2)

### District-Wide Simultaneous Lockdown

**Gap:** No single API endpoint to simultaneously set `lockdown` status across all schools in a district.

Each school is an independent `agencyId`. Setting district-wide lockdown today requires N sequential API calls (one per school). This is too slow for real emergencies.

**Proposed solution:**
- `PATCH /api/campus/district/{districtCode}/threat-level` — set threat level across all sites in a district
- `districtCode` maps to multiple `agencyId` records with `districtCode` metadata
- Fan-out via SQS; each school's threat level updated within 2 seconds

---

### Evacuation Roll Call / Student Accountability

**Gap:** No digital headcount during evacuation. No roll-call capability.

During evacuation, teachers take paper attendance. NexCort iQ has no mechanism to capture:
- Which students are present at the assembly area
- Which students are unaccounted for
- Which students were transported for medical care

**Proposed design:**
- `POST /api/campus/{agencyId}/incidents/{incidentId}/accountability` — start roll call session
- Staff marks students present/absent from their class roster
- Principal dashboard shows real-time % accounted across all classes
- Integrates with SIS roster for class lists (Phase 3)

---

### Drill Scheduling & Compliance Tracking

See `STUDENT_SAFETY.md` → Safety Drills section for full design.

**Short summary:** Add `CAMPUS_DRILLS_TABLE`; new CRUD routes; compliance dashboard UI showing required vs. completed drills by type per school year.

---

### Reunification Management

See `STUDENT_SAFETY.md` → Reunification section.

---

### Parent/Guardian Emergency Notification

**Gap:** No mechanism to notify parents/guardians during an active emergency.

**Current state:** Campus broadcast goes to logged-in staff only. Parents are not in the system.

**Proposed design (requires parent consent infrastructure first):**
1. District collects parent cell numbers + opt-in consent (separate from student record)
2. Store in `CAMPUS_PARENT_CONTACTS_TABLE` with `agencyId`, `studentId`, `phone`, `consentedAt`
3. Emergency notification: `POST /api/campus/{agencyId}/incidents/{incidentId}/parent-notify` fans out to all parent contacts for affected site via Pinpoint
4. Two-way: Parents can reply "STUDENT SAFE" → logged to incident thread

**Legal requirement:** A2P 10DLC campaign registration required before sending; must have prior consent.

---

## Integration with PSAP / 911

Campus NexCort iQ is explicitly **not** a PSAP. The relationship:

```
Campus incident created → staff reviews → staff calls 911 → PSAP dispatches
                                             ↑
                              This step is a human decision.
                              NexCort iQ never auto-dials 911.
```

If the PSAP is a NexCort iQ customer, the campus incident can be shared with the PSAP via:
- **CAD EventBridge** — `incident.created` publishes to the CAD EventBridge bus if configured
- **Phone call** — the escalation record prompts staff to call 911

No automatic 911 call or CAD submission from campus incidents without dispatcher review and approval.

---

## Configuration Reference

Campus admins configure emergency features in `/app/campus/[campusCode]/settings`:

| Setting | Description | Default |
|---------|-------------|---------|
| `silentPanicEnabled` | Show silent panic button in console | `true` |
| `threatLevelPublic` | Show current threat level to QR/public intake | `false` |
| `broadcastSmsEnabled` | Include Pinpoint SMS in broadcast | `false` |
| `autoEscalateTypes` | Incident types that auto-create escalation record | `["active_threat", "weapon_concern"]` |
| `eapAutoMatch` | Auto-attach matching EAP to new incidents | `true` |
| `warRoomsEnabled` | Enable war room feature | `true` when `isWarRoomsEnabled()` is on |

---

## Compliance Notes

| Requirement | Status |
|-------------|--------|
| CISA K-12 School Safety Framework alignment | Partial — EAP, silent panic, threat level match; drills missing |
| FBI/NTAC BTAM guidance | Not implemented (Phase 2) |
| State fire drill compliance documentation | Not implemented (Phase 2) |
| NIMS/ICS incident command structure | Not implemented |
| Sandy Hook Promise "Say Something" anonymous reporting | Partial — anonymous QR/SMS intake; no dedicated tip-line branding |
| Alyssa's Law (NJ, FL, TX) — silent panic alarm | Partial — silent panic exists; physical button integration not built |

**Alyssa's Law** (enacted in NJ 2019, FL 2020, TX 2023) requires schools to have silent panic alarm systems that directly notify law enforcement. NexCort iQ silent panic creates an incident and notifies campus dispatch — the PSAP notification step depends on campus staff calling 911 or a CAD integration being configured.
