# NexCort iQ K–12 — Demo Runbook

**Product:** NexCort iQ Campus (K–12)  
**Audience:** NexCort iQ sales engineers, CSMs, and founders  
**Last updated:** November 2026

---

## Demo Safety Rules (Mandatory)

Before running any demo:

- [ ] Confirm `NSOPW_MOCK=1` is set — never call live NSOPW during demo
- [ ] Confirm `SMS_MOCK=1` is set — never send real SMS
- [ ] Use synthetic demo tenant only (`agencyId = campus-sysdistrict`) — never use a live customer tenant
- [ ] Confirm you are on staging (`app-staging.rapidcortex.us`), not production
- [ ] Do not enter any real student names, real addresses, or real guardian information
- [ ] Do not demo with real license plates (ALPR scenarios use `TEST-PLATE-1234`)

**Demo mode must never query live protected registries, contact public safety agencies, or affect production records.**

---

## Demo Tenant: San Ysidro School District (Staging)

| Field | Value |
|-------|-------|
| District name | San Ysidro School District |
| Agency ID | `campus-sysdistrict` (staging) |
| Campus code | `SYSDISTRICT` |
| Institution type | `k12` |
| Schools | 4 schools (see below) |
| Login URL (staging) | `https://app-staging.rapidcortex.us/app/campus/SYSDISTRICT` |

### Demo Schools

| School | Site code | Grade level | SMS number |
|--------|-----------|-------------|-----------|
| San Ysidro Elementary | `SYSEL` | `es` | Demo only |
| Beyer Elementary | `BYEL` | `es` | Demo only |
| San Ysidro Middle School | `SYMS` | `ms` | Demo only |
| San Ysidro High School | `SYHS` | `hs` | Demo only |

### Demo Users

| Role | Email | Display name |
|------|-------|-------------|
| `campus_admin_k12` | `demo-admin@sysdistrict.demo` | Maria Garcia (District Safety Director) |
| `campus_supervisor_k12` | `demo-supervisor@sysdistrict.demo` | James Chen (Campus Supervisor) |
| `campus_security_k12` | `demo-security@sysdistrict.demo` | Officer Rivera |
| `campus_dispatch_k12` | `demo-dispatch@sysdistrict.demo` | Alex Torres |
| `campus_counselor_k12` | `demo-counselor@sysdistrict.demo` | Dr. Sarah Patel |
| `campus_faculty_k12` | `demo-faculty@sysdistrict.demo` | Mr. Williams (teacher) |

> ⚠️ **TODO:** These users need to be created in Cognito staging and their records seeded in DynamoDB. See Implementation Status doc for setup script.

---

## Demo Flow: Standard 20-Minute Demo

### Pre-demo checklist

- [ ] Staging environment is up
- [ ] Demo tenant has seeded incidents (3–5 recent)
- [ ] Demo visitor log has 10+ entries
- [ ] Screenshot backup prepared (in case staging is down)

---

### Act 1: Visitor Check-In (5 min)

**Talking points:** "Let's start with who's coming through the front door."

1. Log in as `demo-admin@sysdistrict.demo`
2. Navigate to **K-12 Safety → Visitor Verification**
3. Walk through check-in form: "A parent is here to pick up their child. We scan their ID, enter their name..."
4. Enter demo name: **"John Smith"** (synthetic — NSOPW mock will return `cleared`)
5. Submit → show green **"Cleared"** badge
6. Enter demo name: **"James Williams"** (preset to return `review_required` in mock)
7. Show amber **"Review Required"** badge → emphasize: "We surface the flag — your staff makes the call. We never automatically deny entry."

**Key message:** "Takes under 60 seconds. Every visitor is screened against the national sex offender registry. The result goes into your audit log automatically."

---

### Act 2: Anonymous QR Reporting (4 min)

**Talking points:** "Now let's look at how students report concerns without fear of retaliation."

1. Open phone, navigate to demo QR URL: `https://app-staging.rapidcortex.us/campus/SYSDISTRICT/report?rc=DEMO-HALLWAY-1`
2. Show the anonymous report form loading (no login required)
3. Select **Bullying & Misconduct → Bullying**
4. Fill in demo follow-up: "Three times a week, north hallway, witnesses yes"
5. Submit → show "Report submitted" confirmation
6. Switch back to laptop — show incident appearing in dispatch queue in real time
7. Show incident detail: QR location context ("North hallway — Building A"), incident type, follow-up answers

**Key message:** "Students who don't want to be seen can still report safely. Location context comes from the QR code. No app download, no login."

---

### Act 3: Emergency Operations (5 min)

**Talking points:** "Now let's simulate the worst-case scenario."

1. Navigate to the **district dashboard** — show all 4 schools, their grade badges, and current status (all clear)
2. Click on San Ysidro High School → show school-level dashboard
3. Activate **Silent Panic** (SilentPanicPanel): Building A, Main Office, "Potential threat in lobby"
4. Show incident created as `active_threat` with EAP checklist automatically attached
5. Navigate to **Incidents** — show real-time dispatch queue
6. Open incident → show EAP steps: "Lock classroom doors, do not use hallways, call 911..."
7. Set **Threat Level** → `lockdown`
8. Send **Broadcast** → show notification to logged-in staff
9. Return to district panel → show SYHS status is now **Active**

**Key message:** "One button activates silent panic. The EAP checklist is already built for that building and incident type. And the district director can see all four schools from one screen."

---

### Act 4: Counselor Queue (3 min)

**Talking points:** "Student wellness is as important as physical security."

1. Log in as `demo-counselor@sysdistrict.demo` (Dr. Sarah Patel)
2. Show limited navigation — counselor sees only wellness incidents
3. Open a demo **Self-Harm Concern** incident
4. Show counselor view: student welfare follow-up questions, assigned counselor, notes
5. Show "Add Note" → type intervention note → save
6. Show RBAC: "Notice the counselor can't see the security incidents or unrelated reports. Privacy by design."

**Key message:** "School counselors get a focused view of student wellness incidents. They can't see unrelated security incidents. Privacy built in."

---

### Act 5: School Safety Report (3 min)

**Talking points:** "At the end of the reporting period, here's what administrators need."

1. Log back in as admin
2. Navigate to **Reports → School Safety**
3. Set date range: last 90 days
4. Generate PDF → show report layout: incident counts by group, severity breakdown, snapshot of active responders
5. "This is the report your superintendent and school board need. Generated in one click."

**Key message:** "Automated school safety reporting. No manual spreadsheet. PDF ready for the board."

---

## Extended Demo Scenarios (On Request)

### Bluelight Demo
1. Navigate to **Cameras** → show campus camera feeds
2. Navigate to Bluelight panel → show pole registry with locations
3. Activate a demo pole → show activation confirmation

### Pickup Authorization Demo
1. Log in as `demo-faculty@sysdistrict.demo` (teacher)
2. Navigate to **K-12 Safety → Pickup Authorization**
3. Search for demo student "Alex Torres"
4. Show authorized pickup list: Mom (Sarah Torres), Dad (Miguel Torres)
5. Show restricted person: "Robert Torres — custody restriction, do not release"
6. "When grandma shows up and says she can pick up Alex, the teacher checks this list in 15 seconds."

### Vision AI Demo (requires camera setup)
Only available if staging has a camera feed configured. Skip in most demos; use screenshot if available.

---

## Demo Data Seeds Required (TODO)

The following data must be seeded in staging before demos:

### Incidents (pre-seeded)
- 2× `bullying` incidents (resolved)
- 1× `missing_student` incident (resolved, 3 days ago)
- 1× `mental_emotional_distress` (assigned to counselor)
- 1× `active_threat` test incident (resolved, 1 week ago)
- 3× low-severity incidents (vandalism, vaping_tobacco, facility_hazard)

### Visitors (pre-seeded)
- 10 recent visitors with `cleared` status
- 2 visitors with `review_required` status
- 1 visitor with `flagged` status (synthetic name; never a real match)

### Pickup auth records
- 3 students with authorized pickup lists
- 1 student with a restricted person record

### Seed script location
`scripts/seed-demo-k12-tenant.ts` ← **TO BE CREATED** (Phase 6)

---

## Demo Environment Setup

```bash
# Staging env vars required for K-12 demo
NSOPW_MOCK=1                    # Prevent live NSOPW calls
SMS_MOCK=1                      # Prevent live SMS sending
CAMPUS_VISITORS_TABLE=rapid-cortex-campus-visitors-staging
CAMPUS_PICKUP_AUTH_TABLE=rapid-cortex-campus-pickup-auth-staging
CAMPUS_INCIDENTS_TABLE=rapid-cortex-campus-incidents-staging
CAMPUS_CONFIG_TABLE=rapid-cortex-campus-config-staging
```

---

## Objection Handling

| Objection | Response |
|-----------|---------|
| "We use Raptor already — why switch?" | "Raptor does visitor management well. We do that too, plus real-time AI incident triage, anonymous QR/SMS reporting, and camera AI that Raptor doesn't have. We're one platform for the whole safety picture." |
| "We need badge printing" | "Badge printing is on our roadmap for Q1 2027. Here's what we can do today that Raptor can't: [pivot to QR/SMS reporting + AI]." |
| "We need PowerSchool integration" | "We're building the PowerSchool connector now. For pilot, we support manual roster CSV import." |
| "What about FERPA compliance?" | "We act as a service provider under FERPA's school official exception. We provide a signed DPA that covers FERPA, SOPIPA, and your state privacy requirements. Our legal team can review your state-specific requirements." |
| "What if the AI makes a wrong call?" | "NexCort iQ AI never makes decisions — it makes suggestions. Every AI output is labeled 'AI-assisted draft — human review required.' Your staff is always in the loop." |
| "Is this a 911 system?" | "No. NexCort iQ is a school safety coordination platform. It does not replace 911, campus police, or trained responders. The banner on every screen says exactly that." |

---

## Screenshot Backup (Offline Demo)

If staging is unavailable, use the screenshot deck at `docs/k12/demo-screenshots/` (to be added).

Minimum screenshots needed:
- Visitor check-in form (empty)
- Visitor cleared result (green badge)
- Visitor flagged result (amber badge)
- Anonymous QR report form (mobile)
- Incident queue with K-12 types
- Silent panic panel
- District schools panel (multi-school view)
- School safety PDF report sample
