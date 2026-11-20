# NexCort iQ K–12 — Visitor Management & ID Intelligence

**Product:** NexCort iQ Campus (K–12)  
**Last updated:** November 2026  
**Architecture:** Layered, hardware-agnostic ID capture → AWS identity resolution → signed badge accountability

---

## The NexCort Approach vs. Raptor

Raptor sells a USB barcode scanner, a Windows desktop app, and a thermal badge printer. Every desk needs proprietary hardware. When the scanner fails, the desk fails.

NexCort sells a **check-in event** that feeds the emergency command center, the visitor accountability roster, the camera dashboard, and district analytics — all from the same scan. The ID check is the entry point, not the product. Any iPad, Android tablet, or staff phone works.

---

## Layer 1 — ID Capture (four methods, same pipeline)

| Method | How it works | When to use |
|--------|-------------|-------------|
| **Camera scan** | Staff or visitor holds ID up to a tablet/phone camera. Browser captures the PDF417 barcode on the back using the native `BarcodeDetector` API. Auto-fills form fields in <1 second. | Default — works on any device with a camera |
| **Textract OCR** | When the barcode fails (worn, damaged, Safari), staff taps "Barcode won't scan" — the current video frame is sent to AWS Textract which OCRs the front face. | Worn/damaged IDs, Safari, kiosk mode |
| **Pre-registration QR** | Visitor received a QR link before arriving. Scan at arrival = data already in system. | Pre-registered parents, contractors, substitutes *(Phase 3)* |
| **Manual entry fallback** | Staff types name + DOB. No scan hardware needed. | ID expired, legible damage, emergency personnel |

**No proprietary scanner hardware required.** Any iPad, Android tablet, or staff phone works. Optional: Zebra DS2208 or Honeywell Xenon (USB HID, no driver install) for high-volume front desks.

---

## Layer 2 — Identity Resolution (AWS-native)

```
ID captured →
  ┌─── PDF417 barcode decoded (client-side, BarcodeDetector API)
  │      AAMVA fields: firstName, lastName, DOB, state, expiry, ID# (hashed)
  │
  └─── Textract OCR fallback (worn/damaged ID or Safari)
         AnalyzeDocument QUERIES: first name, last name, DOB, expiry, state

  → Validate: ID not expired, state format matches
  → Match: existing visitor profile (by ID number hash — repeats recognized instantly)
  → Screen: NSOPW national + state sex offender registry (dual-query)
  → Result: cleared / flagged / review_required → staff notification
```

**Privacy rules enforced by design:**
- Full ID number is **never stored** — only a one-way SHA-256 hash
- Textract images are analyzed and **discarded** — not saved to S3
- DOB and name stored per district retention policy (configurable)
- Camera frame at check-in: live feed only, not retained by default

---

## Layer 3 — Where NexCort Creates the Differentiator

### Signed Badge QR (implemented)
After every check-in, the system generates a UUID badge token stored in the visitors table. The printed badge carries a URL:
```
https://app.rapidcortex.us/api/campus/badge/{token}
```
Any staff member anywhere on campus scans this QR with their phone browser and gets: visitor name, host, authorized areas, check-in time, and badge expiry. **No app required.** The credential is validated server-side every scan — it cannot be photocopied or reused after checkout.

**Badge expiry:** Defaults to 7pm on the check-in day (school day + 2h safety margin).

### Emergency Accountability Roster (implemented)
Because check-in is a NexCort event, **every active visitor is already in the accountability roster**. During a lockdown or evacuation, the command dashboard shows exactly who is on campus, where they checked in, and who they are visiting. No manual log-to-spreadsheet step, no paper sign-in sheet to find.

### Visitor Sign-Out (implemented)
Front office staff can sign visitors out from the visitor list (one click). Signed-out visitors are excluded from the emergency accountability count.

### Camera Confirmation (Phase 3)
Because NexCort already has camera integration (iQ Vision), when a visitor checks in, the nearest registered lobby camera feed surfaces automatically in the front office UI. Staff visually confirms the person at the desk matches the ID without leaving the screen. **No other visitor management platform does this.**

### Repeat Visitor Fast-Lane (Phase 3)
A visitor who has checked in before and cleared screening gets a pre-registration QR token sent to their email/phone. They tap or scan at the desk, front office confirms face, badge prints in under 10 seconds. Raptor requires the full scan every time.

---

## What Gets Stored and What Doesn't

| Data | Stored | Retention |
|------|--------|-----------|
| Full ID number | No — hashed only (SHA-256) | Never |
| Name + DOB | Yes, in visitor profile | District-configurable |
| Visitor photo | Optional, district policy | District-configurable |
| Screening result | Yes, audit log | Required for compliance |
| Camera frame at check-in | No — live feed only | Not retained by default |
| Textract source image | No — analyzed and discarded | Never |
| Badge token | Yes, visitors table with TTL | Same as visit record |

---

## What NexCort iQ Does (and Does Not Do)

| **Does** | **Does Not** |
|----------|-------------|
| Screen visitors against NSOPW national sex offender registry | Make autonomous access decisions or deny entry |
| Capture visitor identity via barcode, OCR, or manual entry | Replace a sworn officer's judgment |
| Maintain a time-stamped, agency-scoped visit log | Store biometric data or fingerprints |
| Generate signed badge QR for on-campus verification | Automatically lock doors or trigger alarms |
| Feed active visitor list to emergency accountability roster | Certify that a person is safe to work with children |
| Support pickup authorization records for student guardians | Permanently store ID images or card numbers |

**Critical:** A flagged NSOPW result is a notification to staff. It is not an automated denial. The human safety officer makes all access decisions.

---

## Implemented Features

### Visitor Check-In

**Route:** `POST /api/campus/{agencyId}/visitors/check-in`  
**Handler:** `CampusK12Function` → `campus-visitors-service.ts` → `handleVisitorCheckIn()`  
**Auth:** Requires JWT with campus K-12 role; `agencyId` from JWT

**Request schema** (`visitorCheckInBodySchema`):
```typescript
{
  firstName: string        // Required
  lastName: string         // Required
  idType: string           // e.g. "drivers_license", "passport", "state_id"
  idPhotoKey?: string      // S3 key from pre-signed upload (optional)
  visitingStaff?: string   // Staff member being visited
  purposeOfVisit: string   // Required
  vehiclePlate?: string    // Optional vehicle license plate
  phone?: string           // Optional; hashed for privacy
  siteId?: string          // Site code for multi-school districts
}
```

**NSOPW screening flow:**
1. `searchNsopw({ firstName, lastName, state })` called from `packages/shared/src/campus/nsopw-client.ts`
2. Result determines `clearanceStatus`:
   - `"cleared"` — no matches found
   - `"flagged"` — one or more registry matches
   - `"review_required"` — NSOPW API unavailable or ambiguous result
3. Visit record stored with `clearanceStatus`, `nsopwCheckedAt` timestamp, and raw match count
4. Response includes `clearanceStatus` for immediate display on the check-in terminal

**DynamoDB storage:**
- Table: `CAMPUS_VISITORS_TABLE`
- PK: `AGENCY#${agencyId}`
- SK: `VISIT#${dateKey}#${visitorId}` (sortable by date)
- TTL: Configurable; default retain (no auto-delete for compliance)

### Visitor Log

**Route:** `GET /api/campus/{agencyId}/visitors`  
**Auth:** Requires campus admin or supervisor role

Returns paginated list of visitors for the agency, sorted by most recent. Includes clearance status, purpose, visiting staff, and timestamp.

### Pickup Authorization

See `STUDENT_SAFETY.md` → Pickup Authorization section for the full pickup auth workflow.

---

## Missing Features (Phase 2 Build)

### Volunteer & Contractor Management

**Gap:** No volunteer registry or background-check tracking system exists.

Raptor Technologies — the market leader in K-12 visitor management — differentiates primarily on **volunteer management**. Schools legally require background check clearance for recurring visitors (parent chaperones, sports coaches, tutors, contractors).

**Proposed design:**

```typescript
// New shared schema: packages/shared/src/campus/volunteer-schemas.ts
const volunteerRecordSchema = z.object({
  volunteerId: z.string().uuid(),
  agencyId: z.string(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["parent_volunteer", "coach", "tutor", "contractor", "vendor", "other"]),
  backgroundCheckStatus: z.enum(["pending", "cleared", "flagged", "expired", "not_required"]),
  backgroundCheckExpiresAt: z.string().datetime().optional(),
  backgroundCheckProvider: z.string().optional(), // "district_hr", "idemia", etc.
  nsopwLastCheckedAt: z.string().datetime().optional(),
  nsopwClearanceStatus: z.enum(["cleared", "flagged", "review_required", "not_checked"]),
  allowedSites: z.array(z.string()).default([]), // empty = all sites
  notes: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  archivedAt: z.string().datetime().optional(),
});
```

**New DynamoDB table:** `CAMPUS_VOLUNTEERS_TABLE`
- PK: `AGENCY#{agencyId}`
- SK: `VOL#{volunteerId}`
- GSI: `ByStatus` (backgroundCheckStatus + agencyId) for compliance reporting

**New Lambda routes** (add to `CampusK12Function` or new `CampusVolunteerFunction`):
- `GET /api/campus/{agencyId}/volunteers` — list with filter by status/role
- `POST /api/campus/{agencyId}/volunteers` — create volunteer record
- `GET /api/campus/{agencyId}/volunteers/{volunteerId}` — get record
- `PATCH /api/campus/{agencyId}/volunteers/{volunteerId}` — update status/expiry
- `POST /api/campus/{agencyId}/volunteers/{volunteerId}/nsopw-check` — re-run NSOPW check

**Frontend page:** `/app/campus/[campusCode]/volunteers`

**Compliance rule:** A volunteer with `backgroundCheckStatus = "pending"` or `"expired"` must not be automatically denied; show a warning badge and require staff to decide.

### Digital Badge Printing

**Gap:** No badge generation for checked-in visitors.

Visitor management systems (Raptor, Envoy, Sine) print a dated visitor badge with:
- Visitor name + photo
- Date/time + expiry (single-day)
- School name + building
- Purpose of visit
- Clearance status (subtle; not "CLEARED" in large text)

**Proposed implementation:**
- Server-side: generate badge PDF using `pdfkit` (already a dependency via `campus-after-action-pdf.ts`)
- Client: `GET /api/campus/{agencyId}/visitors/{visitId}/badge-pdf` → download/print
- Badge layout: 3" × 4" label format (Dymo 450 compatible); also printable on 8.5×11

### Sign-Out Workflow

**Gap:** No visitor sign-out; no active visitor tracking.

Each visitor record should have:
- `checkedInAt` — set on check-in
- `checkedOutAt` — set on sign-out (nullable)
- `isActive` — derived boolean

**New route:** `PATCH /api/campus/{agencyId}/visitors/{visitId}/sign-out`

### Returning Visitor Fast-Lane

**Gap:** Every visit triggers a full NSOPW API call even for recognized frequent visitors.

For cleared frequent visitors (staff family members, regular contractors), offer:
- "Returning visitor" button: auto-fills name from previous visit
- NSOPW re-check only if `nsopwCheckedAt` > 30 days ago (configurable)
- Display `"Previously cleared — ${nsopwCheckedAt}"` to staff

### Agency-Defined Watch List

**Gap:** Only NSOPW national registry; no per-agency custom list.

Districts may need to flag specific non-offender individuals (e.g., prior trespass incidents, restraining orders, custody disputes). This is distinct from NSOPW.

**Schema addition:** `watchList[]` on campus config; each entry: `{ name, reason, addedBy, addedAt, photoKey? }`. Check via fuzzy name match (Levenshtein) at check-in; display warning to staff.

**Security note:** Watch list matches are **advisory only** — no automated denial. Fuzzy match threshold must be generous; never deny access solely on AI/fuzzy match.

---

## NSOPW Integration Details

**Service:** National Sex Offender Public Website (NSOPW) — federal government API  
**File:** `packages/shared/src/campus/nsopw-client.ts`  
**Base URL:** `https://www.nsopw.gov/api/Search/GetSearchResult`  
**Auth:** No API key required (public)  
**Rate limits:** Reasonable use; no published SLA

**Search parameters:**

```typescript
interface NsopwSearchParams {
  firstName: string;
  lastName: string;
  state?: string;  // 2-letter state code; omit for national search
}
```

**Demo mode:** When `NSOPW_MOCK=1` (not yet implemented), return fixture `{ cleared }` result. Never call live NSOPW in demo mode or automated tests.

**Privacy:** NSOPW API does not receive student or school staff information. Only the visitor's name is transmitted. No FERPA data leaves the system.

**Result interpretation:**
| Status | Meaning | Staff action |
|--------|---------|-------------|
| `cleared` | No matches in NSOPW | Proceed per school policy |
| `flagged` | 1+ registry matches | Notify principal; do not admit pending review |
| `review_required` | API error or ambiguous | Manual check; do not auto-admit |

---

## Privacy & Data Retention

- Visitor names and vehicle plates are **PII**; stored encrypted at rest in DynamoDB (AWS KMS)
- `phone` field is stored as SHA-256 hash (`hashPhoneSha256()`); never stored in plaintext
- Photo uploads (`idPhotoKey`) stored in S3 with agency-scoped prefix; server-side encryption
- Retention: Configure via CloudFormation parameter; default: retain indefinitely (no TTL)
- FERPA does not directly apply to visitor records (non-student data), but state student privacy laws may impose access restrictions
- Right to deletion: districts may issue `DELETE /api/campus/{agencyId}/visitors/{visitId}` (RBAC: admin only)

---

## Configuration

Campus admins configure the following in `/app/campus/[campusCode]/settings`:

| Setting | Description | Default |
|---------|-------------|---------|
| `nsopwEnabled` | Enable NSOPW screening on check-in | `true` |
| `nsopwState` | 2-letter state code for NSOPW search scope | `null` (national) |
| `requireIdPhoto` | Require ID photo capture on check-in | `false` |
| `requireVehiclePlate` | Require vehicle plate on check-in | `false` |
| `badgePrintEnabled` | Show badge print button after check-in | `true` |
| `visitorSignOutEnabled` | Enable sign-out workflow | `true` |

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/campus/{agencyId}/visitors/check-in` | Campus role JWT | Check in a visitor (v2: scan-enriched fields); runs NSOPW; generates badge token |
| `POST` | `/api/campus/{agencyId}/visitors/extract-id` | Campus role JWT | Textract OCR fallback — image bytes in body, returns `ExtractedIdFields` |
| `GET` | `/api/campus/{agencyId}/visitors` | Campus admin/supervisor | List recent visitors |
| `GET` | `/api/campus/{agencyId}/visitors/{visitId}` | Campus admin/supervisor | Get single visit record |
| `POST` | `/api/campus/{agencyId}/visitors/{visitId}/sign-out` | Campus role JWT | Sign out visitor (sets `checkedOutAt`, removes from accountability roster) |
| `GET` | `/api/campus/badge/{badgeToken}` | **None — public** | On-campus badge verification — name, clearance, host, expiry |
| `GET` | `/api/campus/{agencyId}/volunteers` | Campus admin/supervisor | List volunteers |
| `POST` | `/api/campus/{agencyId}/volunteers` | Campus admin | Create volunteer |
| `PATCH` | `/api/campus/{agencyId}/volunteers/{id}` | Campus admin | Update volunteer |
| `POST` | `/api/campus/{agencyId}/volunteers/{id}/nsopw-check` | Campus admin | Re-run NSOPW _(Phase 2)_ |
