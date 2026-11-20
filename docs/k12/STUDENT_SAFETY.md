# NexCort iQ K–12 — Student Safety

**Product:** NexCort iQ Campus (K–12)  
**Last updated:** November 2026

---

## Overview

The student safety module covers everything that happens *after* the school doors open: incident reporting, pickup authorization, counselor wellness queue, behavioral threat assessment, and reunification during emergencies. It bridges the gap between traditional "visitor management" (who comes in) and "student welfare" (what happens to students while in school).

---

## Pickup Authorization (Implemented)

### What it does
Schools maintain a per-student list of adults authorized to pick up that student. During dismissal or early-release, staff verify the arriving adult against this list before releasing the student.

### Implementation

**Route:** `GET/PUT /api/campus/{agencyId}/pickup-auth`  
**Handler:** `CampusK12Function` → `campus-pickup-service.ts`  
**Auth:** Requires campus K-12 role; `agencyId` from JWT  
**Frontend:** `/app/campus/[campusCode]/pickup-auth/page.tsx`

**Data model:**
```typescript
// packages/shared — studentPickupRecordSchema
{
  agencyId: string
  studentId: string               // School-assigned ID or UUID
  studentName: string
  authorizedPersons: Array<{
    personId: string
    name: string
    relationship: string          // "parent", "grandparent", "sibling_18+", etc.
    phone: string
    photoKey?: string             // S3 key for photo
    notes?: string
  }>
  restrictedPersonIds: string[]   // IDs of persons NOT authorized (custody restrictions)
}
```

**DynamoDB:**
- Table: `CAMPUS_PICKUP_AUTH_TABLE`
- PK: `AGENCY#{agencyId}`
- SK: `STUDENT#{studentId}`

### Role access

| Role | Access |
|------|--------|
| `campus_admin_k12` | Read + write |
| `campus_supervisor_k12` | Read + write |
| `campus_security_k12` | Read + write |
| `campus_dispatch_k12` | Read + write |
| `campus_counselor_k12` | No access |
| `campus_faculty_k12` | Read-only |

Faculty (teachers) can view the authorized pickup list during dismissal but cannot modify it.

### Known gaps (Phase 2)

- **Photo upload flow:** `photoKey` field exists but browser upload UI is not fully confirmed
- **Court order documents:** No ability to attach a custody order or restraining order PDF to a restriction record
- **Guardian notification:** No "restricted person attempted pickup" alert to authorized guardians
- **Dismissal workflow:** No end-of-day dismissal log or bulk "student released to: [name]" record
- **Student lookup:** No name/ID search; callers must know the exact `studentId`
- **SIS sync:** No PowerSchool/Infinite Campus import; records must be entered manually

---

## Incident Reporting (Implemented)

### K-12 Incident Type Catalog

The platform ships with a **50+ type, 8-group K-12 incident taxonomy** in `packages/shared/src/campus/incident-types.ts` and `k12-intake.ts`.

#### Incident Groups

| Group ID | Label | Example Types |
|----------|-------|---------------|
| `emergency_threats` | Emergency & Threats | active_threat, weapon_concern, fight, fire_smoke, bomb_threat |
| `student_safety_wellness` | Student Safety & Wellness | self_harm, missing_student, abuse_neglect, mental_emotional_distress |
| `bullying_misconduct` | Bullying & Misconduct | bullying, cyberbullying, harassment, sexual_misconduct, staff_conduct |
| `drugs_prohibited` | Drugs & Prohibited Items | drug_alcohol, overdose_poisoning, vaping_tobacco |
| `medical_health` | Medical & Health | medical_emergency, injury_accident |
| `security_suspicious` | Security & Suspicious Activity | suspicious_person, unauthorized_visitor, custody_pickup, gang_related |
| `transport_facilities` | Transportation & Facilities | bus_transportation, facility_hazard, vandalism |
| `other_concerns` | Other Concerns | other |

#### Severity & Escalation Matrix

| Severity | Types | Auto-behavior |
|----------|-------|---------------|
| `critical` | active_threat, weapon_concern, medical_emergency, sexual_misconduct, fire_smoke, bomb_threat, overdose_poisoning, missing_student, abuse_neglect, trafficking_exploitation | Requires escalation; EAP auto-matched |
| `high` | self_harm, mental_emotional_distress, missing_student, unauthorized_visitor, gang_related, bus_transportation | Counselor assignment for wellness types |
| `medium` | bullying, harassment, suspicious_activity, injury_accident | Standard queue |
| `low` | vaping_tobacco, vandalism, theft | Informational |

### Intake Channels

| Channel | Route | Auth | Notes |
|---------|-------|------|-------|
| Anonymous QR scan | `POST /api/public/campus/report` | None | Rate-limited 5/IP/hr; building/floor from RCLI |
| Anonymous SMS | Pinpoint inbound | None | Phone hash stored; carrier location requested |
| Staff manual | `POST /api/campus/incidents` | JWT required | Full incident form with all fields |
| Security webhook | `POST /api/public/campus/{code}/security-events` | API key | VMS/ALPR/alarm → mapped to incident type |
| NFC tag | Same as QR | None | Location from NFC tag RCLI |

### Follow-Up Intake Questions

For high-severity types, the anonymous public report form presents type-specific follow-up questions (`K12_FOLLOW_UP_BY_TYPE`):

| Type | Key questions asked |
|------|---------------------|
| `weapon_concern` | Is weapon visible now? Type? Location? Person description? |
| `active_threat` | Happening right now? Where? Anyone injured/trapped? |
| `bullying` | Who involved? How often? Location? Screenshots? |
| `self_harm` | Immediate danger? Who? What observed? |
| `custody_pickup` | Which student? Adult description? Custody restriction known? |

### Incident Lifecycle

```
open → assigned → responding → resolved → referred → escalated
```

Staff can add notes at any status. Escalation creates a formal escalation record with reason and timestamp. Referral tracks external handoff (school counselor, law enforcement, hospital).

---

## Counselor Wellness Queue (Implemented)

### What it does
The counselor role receives a **filtered incident view** showing only wellness-related incidents: `mental_health` and `wellness_check`. This protects student privacy — a counselor should not see security incidents unrelated to their scope.

### Implementation

**Filter:** `GET /api/campus/incidents?queue=counselor` or auto-applied when `role = campus_counselor_k12` and `canViewIncidents = false`  
**Types in queue:** `["mental_health", "wellness_check"]` from `counselor-queue.ts`; also any incident with `assignedTo = "campus_counselor"`  
**Auto-assignment:** When a new incident with type `mental_emotional_distress`, `self_harm`, or `wellness_check` is created, `campus-incident-service.ts` auto-assigns to `"campus_counselor"` queue

**Frontend:** `/app/campus/counselor/page.tsx` — counselor-specific landing page

### Gaps (Phase 2)

- **Push notification to counselor:** No real-time push or SMS alert to counselor when a new mental health incident is created
- **Counselor notes privacy:** Counselor notes are visible to campus admin; no HIPAA-style restricted counselor notes
- **Crisis protocol checklists:** No type-specific counselor checklist (e.g., "Steps for self-harm disclosure")

---

## Behavioral Threat Assessment (Missing — Phase 2)

### Background

Behavioral Threat Assessment & Management (BTAM) is the evidence-based process for evaluating students who make threats or exhibit concerning behaviors before an incident occurs. CISA and NTAC (National Threat Assessment Center) recommend every K-12 school have a Threat Assessment Team (TAT) and use a formal case management process.

This is **entirely absent** from the current platform and represents a major gap vs. Raptor Technologies (which acquired Agilix Buzz in 2022 specifically for BTAM) and Lightspeed Systems.

### Proposed Schema

```typescript
// packages/shared/src/campus/btam-schemas.ts
const btamCaseSeveritySchema = z.enum(["low", "moderate", "high", "imminent"]);
const btamCaseStatusSchema = z.enum(["open", "in_review", "monitoring", "closed"]);

const btamCaseSchema = z.object({
  caseId: z.string().uuid(),
  agencyId: z.string(),
  campusCode: z.string(),
  siteId: z.string().optional(),         // Which school
  
  // Subject (not necessarily student — could be staff, community member)
  subjectType: z.enum(["student", "staff", "community", "unknown"]),
  subjectName: z.string().optional(),    // Stored separately from student records
  subjectGrade: z.string().optional(),
  
  // Case details
  status: btamCaseStatusSchema,
  severity: btamCaseSeveritySchema,
  triggerIncidentId: z.string().optional(), // Linked incident that opened the case
  
  // TAT (Threat Assessment Team)
  teamMembers: z.array(z.object({
    userId: z.string(),
    name: z.string(),
    role: z.string(), // "principal", "counselor", "security", "law_enforcement_liaison"
  })),
  
  // Case notes + actions
  notes: z.array(z.object({
    noteId: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    content: z.string().max(5000),
    createdAt: z.string().datetime(),
    isConfidential: z.boolean().default(false),
  })),
  
  // Interventions
  interventions: z.array(z.object({
    interventionId: z.string(),
    type: z.enum(["counseling", "parent_meeting", "suspension", "law_enforcement_referral", "mental_health_referral", "safety_plan", "monitoring", "other"]),
    description: z.string(),
    completedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
  })),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
  closedReason: z.string().optional(),
});
```

**DynamoDB table:** `CAMPUS_BTAM_TABLE`
- PK: `AGENCY#{agencyId}`
- SK: `CASE#{caseId}`
- GSI1: `BySite` — `siteId` + `status` for site-level dashboard
- GSI2: `ByStatus` — `status` + `createdAt` for open case queue

**New routes** (add to `CampusK12Function` or dedicated `CampusBtamFunction`):
- `GET /api/campus/{agencyId}/btam/cases` — list cases
- `POST /api/campus/{agencyId}/btam/cases` — open new case
- `GET /api/campus/{agencyId}/btam/cases/{caseId}` — get case detail
- `PATCH /api/campus/{agencyId}/btam/cases/{caseId}` — update status/severity
- `POST /api/campus/{agencyId}/btam/cases/{caseId}/notes` — add note
- `POST /api/campus/{agencyId}/btam/cases/{caseId}/interventions` — record intervention
- `POST /api/campus/{agencyId}/btam/cases/{caseId}/close` — close case with reason

**Frontend page:** `/app/campus/[campusCode]/threat-assessment`

**AI guardrails (mandatory):**
- AI may **suggest** severity levels and intervention options based on incident description
- AI must **never** automatically close, escalate, or identify a suspect
- All AI suggestions labeled "AI-assisted — requires human review"
- Final severity determination and case actions require human TAT member input

---

## Safety Drills (Missing — Phase 2)

### Background

Most states require a minimum number of safety drills per school year (fire evacuation, lockdown, shelter-in-place, bus evacuation). Schools must document date, type, duration, and participation for state compliance reporting. This is completely absent from NexCort iQ.

### Required Drill Types

| Type | CISA/FEMA code | Typical frequency |
|------|---------------|-------------------|
| Fire evacuation | EVACUATE | Monthly (10/year most states) |
| Lockdown | LOCKDOWN | 2–3/year |
| Shelter-in-place | SHELTER | 1–2/year |
| Soft lockout | SECURE | 1–2/year |
| Severe weather | SHELTER-WEATHER | 1–2/year |
| Bus evacuation | TRANSPORT-EVAC | 1/year |

### Proposed Schema

```typescript
// packages/shared/src/campus/drill-schemas.ts
const drillTypeSchema = z.enum([
  "fire_evacuation", "lockdown", "shelter_in_place", 
  "soft_lockout", "severe_weather", "bus_evacuation", "other"
]);

const drillRecordSchema = z.object({
  drillId: z.string().uuid(),
  agencyId: z.string(),
  siteId: z.string(),       // Which school
  type: drillTypeSchema,
  scheduledAt: z.string().datetime().optional(),
  conductedAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(1).optional(),
  participantCount: z.number().int().min(0).optional(),
  issues: z.string().max(2000).optional(), // Noted deficiencies
  conductedBy: z.string(),  // Staff name
  notes: z.string().max(2000).optional(),
  schoolYear: z.string().regex(/^\d{4}-\d{2}$/), // "2026-27"
  status: z.enum(["scheduled", "completed", "cancelled"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

**New routes:**
- `GET /api/campus/{agencyId}/drills?siteId=&schoolYear=` — list drills for compliance view
- `POST /api/campus/{agencyId}/drills` — log a completed drill
- `GET /api/campus/{agencyId}/drills/compliance?schoolYear=` — compliance summary (required vs. completed by type)

**Frontend page:** `/app/campus/[campusCode]/drills` with compliance dashboard and state requirement tracker

---

## Reunification (Missing — Phase 2)

During a large-scale emergency (active threat, fire, gas leak), students are evacuated to a reunification site. Schools must systematically release students to their authorized guardians and account for every student.

### Proposed design

- **Reunification event:** Linked to a campus incident; site-specific or district-wide
- **Student accountability:** Mark each student as `in_care`, `released`, `unaccounted`, `medical_transport`
- **Guardian match:** Staff scans/enters guardian ID; system confirms against pickup auth records
- **Digital roster:** Pull from SIS (Phase 3) or manual roster upload
- **Status dashboard:** Real-time counts; principal view shows % accounted

This feature requires SIS integration to be effective at scale; see `INTEGRATION_MATRIX.md`.

---

## Student Privacy Rules

| Data Type | Governed by | Rule |
|-----------|-------------|------|
| Student name + grade | FERPA | Never log in CloudWatch; restricted to agency users |
| Incident records | FERPA (if linked to student) | Access restricted by role; audit every access |
| Counselor notes | FERPA + professional privilege | Phase 2: confidential note flag; visible only to counselor + principal |
| Pickup auth records | FERPA + state custody law | Restricted to campus users; `agencyId` scoped |
| NSOPW match results | No PII of student | Visitor data; standard retention |
| BTAM case records | FERPA + IDEA (if disability) | Most restricted; TAT members only |
| Medical/health events | FERPA + HIPAA (school nurse) | Out of scope Phase 1; school nurse role required |

**Fundamental rule:** Student records must never be used to automatically deny service, determine threat level, or identify suspects without human review.
