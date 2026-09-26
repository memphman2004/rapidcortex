# NexCortiQ — Cursor Execution Plan
## Complete all outstanding build items

**Codebase:** NexCortiQ (formerly Rapid Cortex) — Next.js 14 App Router, TypeScript, AWS Lambda, DynamoDB, SAM  
**Priority:** Work sections in order. Do not skip acceptance criteria.  
**When complete:** Run `bash scripts/run-cross-agency-isolation-test.sh` and `bash scripts/post-deploy-smoke.sh` against dev.

---

## How to read this document

Each task includes:
- **Context** — why it matters
- **File(s)** — exact paths to create or modify
- **Spec** — what to build
- **Acceptance criteria** — how to verify it's done

---

## CODEBASE CONVENTIONS

Before writing any code, internalize these patterns:

```
apps/web/app/(app)/[agencySlug]/   ← per-agency Next.js routes
apps/web/components/               ← shared React components
apps/api/src/handlers/             ← Lambda handler functions
packages/shared/src/               ← shared TypeScript types
```

**UI stack:** Next.js 14, TypeScript, Tailwind CSS, tanstack/react-query, lucide-react  
**Dark theme tokens (use these exactly):**
```
background:     #0f1117   (page)
surface:        #161b2e   (cards)
surface-alt:    #1a2035   (nested)
border:         #1e2130
text-primary:   #e2e4ea
text-secondary: #9ca3af
text-muted:     #6b7280
teal/primary:   #1D9E75
blue/accent:    #378ADD
red/danger:     #E24B4A
amber/warning:  #EF9F27
purple/ai:      #7C3AED
```

**Data fetching pattern:**
```typescript
// In client components use tanstack/react-query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { data, isLoading, error } = useQuery({
  queryKey: ['feature', agencyId],
  queryFn: () => fetch(`/api/agencies/${agencyId}/feature`).then(r => r.json()),
});
```

**Icons:** Use lucide-react. Common: `Shield, AlertTriangle, Users, Clock, 
MapPin, Phone, Video, FileText, Activity, Bell, CheckCircle, XCircle, 
Search, Plus, ChevronRight, Eye, Download, Upload, Globe, Zap, Radio`

**Real-time:** Use existing `useAgencyWebSocket` hook at 
`apps/web/hooks/use-agency-websocket.ts`

**Route guard pattern:** Check `canDispatch(role)`, `canSupervise(role)`, 
`canAdminAgency(role)` from `apps/web/lib/auth/role-guards.ts`

**Import shared types from:** `nexcortiq-shared` (or current package name in package.json)

---

## SECTION 1: FEATURE UIs (13 Components)

Build all 13 feature UIs. Each needs:
1. A page route file (`page.tsx`)
2. A client component file (`*-client.tsx`)
3. Navigation registration (see Section 1.14)

---

### 1.1 — Citizen Safety Registry UI

**Context:** Agencies need to manage enrolled citizen profiles and dispatchers need
to see a citizen's profile when a matching call comes in.

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/settings/citizen-registry/page.tsx
apps/web/app/(app)/[agencySlug]/settings/citizen-registry/citizen-registry-client.tsx
apps/web/components/dispatch/CitizenProfileCard.tsx
```

**citizen-registry-client.tsx spec:**

Admin/supervisor view with three panels:

**Panel A — Enrollment stats:**
- Total enrolled citizens
- New this month
- Enrollments with medical flags
- Enrollments with mobility limitations

**Panel B — Citizen profiles table:**
- Columns: Phone, Name, Primary Language, Mobility, Medical Flags, Last Updated, Actions
- Search by phone or address
- Click row → drawer showing full profile:
  - Contact info, address, language preferences
  - Medical conditions list with severity badges
  - Household members
  - Pets (species, name, aggressive flag in red)
  - Access notes (gate codes, building entry)
  - Special instructions (highlighted box)
  - Enrolled via badge (QR / SMS / Web / In-person)
- Edit button on drawer → opens edit form
- Delete button → confirmation modal with "This removes the profile per right-to-delete request"

**Panel C — Registration link generator:**
- Generate a QR code that links to the citizen self-registration portal
- Copy link button
- QR code download button
- Select which agency to associate registrations with

**CitizenProfileCard.tsx spec:**

Inline card shown in the dispatcher's active call view when a citizen profile match is found:
```
┌─────────────────────────────────────────┐
│ 🧑 CITIZEN PROFILE MATCH                │
│ Jane D. · Primary: Spanish              │
├─────────────────────────────────────────┤
│ ⚠ Type 1 Diabetes — carries insulin pen │
│ 🦽 Non-ambulatory — wheelchair          │
│ 🐕 Rex (German Shepherd, not aggressive)│
│ 🔑 Gate code: 4412 · Unit 3B           │
└─────────────────────────────────────────┘
```
- Teal left border
- Collapsible (default expanded on match)
- Shows only if a profile was found via phone lookup
- Calls `/api/agencies/${agencyId}/citizens/lookup?phone=${callerPhone}` on call connect
- Uses WebSocket message type `CALL_CONNECTED` to trigger lookup

**Acceptance criteria:**
- [ ] Profile list loads and is searchable
- [ ] Profile drawer shows all fields
- [ ] CitizenProfileCard appears in call view when phone matches
- [ ] Delete confirms and removes profile
- [ ] QR code generates correctly

---

### 1.2 — Address Intelligence Panel

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/settings/address-intelligence/page.tsx
apps/web/app/(app)/[agencySlug]/settings/address-intelligence/address-intelligence-client.tsx
apps/web/components/dispatch/AddressIntelPanel.tsx
```

**AddressIntelPanel.tsx spec (inline in incident view):**

Appears in the active incident sidebar when an incident address is present.
Calls `/api/agencies/${agencyId}/address/intelligence?street=&city=&state=&zip=`

Layout:
```
┌─────────────────────────────────────────┐
│ 📍 ADDRESS INTELLIGENCE                 │
│ 847 Riverside Dr — 3 prior incidents    │
├─────────────────────────────────────────┤
│ ⚠ HAZARDS                              │
│  🔴 Aggressive dog (verified)           │
│  🟡 Gas shutoff: left side of house     │
├─────────────────────────────────────────┤
│ 🧑 OCCUPANTS                           │
│  Non-ambulatory resident — 2nd floor    │
│  1 citizen profile on file              │
├─────────────────────────────────────────┤
│ 🏠 PRE-PLAN  [View floor plan]         │
│  Residential · 2 floors                 │
│  Contact: John (owner) 555-0147         │
├─────────────────────────────────────────┤
│ 🔑 ACCESS  [Show codes]                │
│  Gate: 4412 · Front door: key lockbox   │
└─────────────────────────────────────────┘
```
- "Show codes" requires supervisor role — blur codes for dispatchers
- "View floor plan" opens a modal with the S3-hosted floor plan PDF
- Prior incidents expand to show type, date, disposition

**address-intelligence-client.tsx spec (settings page):**

Admin panel for managing address records:
- Search by address
- View full intelligence record
- Add hazard form (type, severity, description, expiry date)
- Upload pre-plan (triggers floor plan upload flow)
- Add/edit access notes and gate codes (encrypted, supervisor-only visibility)
- Pre-plan management: upload floor plans per level, annotate with pins

**Acceptance criteria:**
- [ ] Panel loads and displays prior incidents
- [ ] Hazards show with color-coded severity
- [ ] Gate codes are blurred for dispatchers, visible for supervisors
- [ ] Floor plan opens in modal
- [ ] Admin can add hazards and pre-plans

---

### 1.3 — Alternative Response Flag UI

**Files to create:**
```
apps/web/components/dispatch/AltResponseFlag.tsx
apps/web/app/(app)/[agencySlug]/settings/alt-response/page.tsx
apps/web/app/(app)/[agencySlug]/settings/alt-response/alt-response-client.tsx
```

**AltResponseFlag.tsx spec (inline in incident view):**

Appears when AI detects alternative response signals. Rendered above CAD dispatch controls.

```
┌─────────────────────────────────────────────┐
│ ⚡ ALTERNATIVE RESPONSE SUGGESTED          │
│ Mental health crisis indicators detected    │
│ Confidence: 87% · Signals: "breakdown",     │
│ "not taking meds", "hearing voices"         │
├─────────────────────────────────────────────┤
│ AVAILABLE CO-RESPONDERS                     │
│  🟢 Hamilton MH Mobile Crisis · Est. 8 min  │
│  🟢 Peer Support Unit 2 · Est. 12 min       │
│  🔴 CAHOOTS Team · Unavailable              │
├─────────────────────────────────────────────┤
│ [Dispatch Alt Response]  [Route to LEO]     │
│ [Route to EMS]          [Dismiss]           │
└─────────────────────────────────────────────┘
```
- Only visible if `ALT_RESPONSE` record exists for the incident
- Supervisor auto-alerted via WebSocket on detection
- Decision buttons call `POST /api/agencies/${agencyId}/incidents/${id}/alt-response/decision`
- Dismissed → collapses but logs the decision
- Amber color scheme (warning, not danger)

**alt-response-client.tsx spec (settings):**

Supervisor/admin panel:
- Toggle: Enable alternative response detection (per agency)
- Confidence threshold slider (50–95%)
- Response type toggles (enable/disable each of 8 types)
- Co-responder unit management:
  - List of configured co-responder units
  - Add/edit unit (name, type, phone, coverage zone, specializations, shift hours)
  - Unit availability schedule
- Outcome reporting: Table of past alt-response events with decisions and outcomes

**Acceptance criteria:**
- [ ] Flag appears in incident view when AI detects indicators
- [ ] Available co-responders listed with availability
- [ ] Decision is recorded and flag collapses
- [ ] Admin can configure detection settings and co-responder units

---

### 1.4 — Mutual Aid Resource Board UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/operations/mutual-aid/page.tsx
apps/web/app/(app)/[agencySlug]/operations/mutual-aid/mutual-aid-client.tsx
```

**mutual-aid-client.tsx spec:**

Two-tab layout:

**Tab: Active Requests**
- List of open mutual aid requests from partner agencies (via CAD mesh)
- Each card:
  - Requesting agency name + priority badge (P1–P5)
  - Incident type, location
  - Resources needed: e.g., "3× ALS Unit (2 filled), 1× Command Unit (0 filled)"
  - Time since request
  - [Commit Resources] button → opens commitment modal
  - Status: open / partially filled / filled
- Filter by: All / My Agency Requests / Partner Requests
- Real-time updates via WebSocket type `MUTUAL_AID_UPDATE`

**Commit Resources Modal:**
- Select units from agency unit list
- Specify quantity
- Set estimated arrival time
- [Confirm Commitment] → calls `POST /api/agencies/${agencyId}/mutual-aid/${requestId}/commit`

**Tab: My Agency Requests**
- Create new request form:
  - Linked incident (optional)
  - Resources needed (add rows: type, quantity, qualifications, notes)
  - Priority, location, needed-by time
  - ICS form number (optional)
- Active requests with commitment status
- Track committed resources through status changes:
  - Committed → En Route → On Scene → Released
- Close request button when resources no longer needed

**Resource tracker view:**
- Timeline showing each committed unit's status history
- "Release unit" button → calls status update endpoint

**Acceptance criteria:**
- [ ] Open requests from partner agencies visible in real time
- [ ] Can commit resources with unit selection
- [ ] Can create new request
- [ ] Resource status progresses through lifecycle
- [ ] Request can be closed

---

### 1.5 — MCI Command Console UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/operations/mci/page.tsx
apps/web/app/(app)/[agencySlug]/operations/mci/[mciId]/page.tsx
apps/web/app/(app)/[agencySlug]/operations/mci/[mciId]/mci-command-client.tsx
```

**mci/page.tsx:**
- Lists active and recent MCI events
- [Activate MCI] button → modal: name, incident type, location, severity, link to CAD incident
- Active MCIs shown as high-priority cards with live patient counts

**mci-command-client.tsx spec:**

Full-screen command console layout:

**Top bar:**
- MCI name, status badge, commander name
- Live patient count: RED: 4 | YELLOW: 12 | GREEN: 23 | BLACK: 2 | GRAY: 8
- Elapsed time since activation
- [Close MCI] button (requires confirmation)

**Left panel — Patient triage board:**
- 5 columns: RED / YELLOW / GREEN / BLACK / UNCLASSIFIED
- Each patient card shows:
  - Tag number (large)
  - Chief complaint, age/sex if entered
  - Zone
  - Transport status badge
  - [Edit] button
- [+ Add Patient] button → quick-entry form:
  - Tag number, triage color, zone, chief complaint, age, sex
  - Vital signs (optional): resp rate, radial pulse, GCS, SpO2
  - Transport status
- Click patient card → expanded detail with transport assignment

**Right panel — Hospital board:**
- Table of hospitals: Name, Trauma Level, Distance, Diversion, Available Beds, Accepting
- Color coding: green = accepting, amber = limited, red = diversion
- [Update Board] button → opens form to update capacity data
- Hospital cells show green/red icons per category (trauma, peds, burn, cardiac, stroke)

**Bottom bar — Transport coordinator:**
- List of patients with transport status "awaiting"
- Hospital recommendation based on: injury severity, trauma level, distance, diversion status
- [Assign Transport] → select unit and hospital → updates patient record

**Acceptance criteria:**
- [ ] MCI activates and shows command console
- [ ] Patients can be added and moved between triage zones
- [ ] Hospital board updates in real time
- [ ] Transport can be assigned per patient
- [ ] Patient count in top bar updates on every change

---

### 1.6 — Critical Infrastructure Pre-Plans UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/settings/infrastructure/page.tsx
apps/web/app/(app)/[agencySlug]/settings/infrastructure/infrastructure-client.tsx
apps/web/components/dispatch/InfrastructurePanel.tsx
```

**infrastructure-client.tsx spec:**

**List view:**
- Filter by type: School K-12, University, Hospital, Government, Utility, Stadium, etc.
- Search by name or address
- Card grid with: facility name, type icon, address, floor plan count, protocol count, last reviewed date

**Detail/edit view (drawer or page):**
- Facility info: name, type, address, occupancy load, operating hours
- Contacts: primary, after-hours, security — editable table
- Floor plans: Upload button per floor level, list of uploaded plans with viewer
  - Floor plan viewer: embedded PDF viewer with annotation layer
  - Annotation toolbar: add pins for fire extinguisher, AED, stairwell, electrical panel, hazmat, shutoffs
- Protocols: list by incident type
  - Add/edit protocol: incident type, title, steps (ordered drag-drop list)
  - Each step: action text, responsible party, timeframe
- Hazards: same pattern as address intelligence hazards
- Access points: list with key code (supervisor-only visible)

**InfrastructurePanel.tsx spec (inline in incident view):**

Appears when incident address matches a critical infrastructure record:
```
┌─────────────────────────────────────────┐
│ 🏫 CRITICAL INFRASTRUCTURE              │
│ Lincoln Elementary School               │
├─────────────────────────────────────────┤
│ [View Floor Plan]  [Active Shooter SOP] │
│ [Fire Protocol]    [Medical Protocol]   │
├─────────────────────────────────────────┤
│ CONTACTS                                │
│ Principal Chen: 555-0198               │
│ Custodian (after hrs): 555-0211        │
│ Security: 555-0244                      │
└─────────────────────────────────────────┘
```
- Protocol buttons auto-expand showing the steps checklist
- Dispatcher can check steps off as they communicate them

**Acceptance criteria:**
- [ ] Infrastructure list loads by type filter
- [ ] Floor plans upload and display correctly
- [ ] Protocols with ordered steps can be created and edited
- [ ] InfrastructurePanel matches address to incident in real time
- [ ] Protocol checklist works in incident view

---

### 1.7 — Interpreter Dispatch UI (with Convey911 integration)

**Files to create:**
```
apps/web/components/dispatch/InterpreterPanel.tsx
apps/web/app/(app)/[agencySlug]/reports/language-access/page.tsx
apps/web/app/(app)/[agencySlug]/reports/language-access/language-access-client.tsx
```

**InterpreterPanel.tsx spec (inline in call view):**

Triggered automatically when AI detects non-English language OR dispatcher clicks "Language Access":
```
┌─────────────────────────────────────────────┐
│ 🌐 LANGUAGE ACCESS                         │
│ Detected: Spanish (AI confidence: 94%)     │
├─────────────────────────────────────────────┤
│ [AI Translation Active]                     │
│ [Connect Human Interpreter — Convey911]     │
│ [ASL Video Interpreter]                     │
├─────────────────────────────────────────────┤
│ Status: Connecting... 00:04               │
│ Interpreter: Maria G. · Spanish            │
│ Session: 3m 42s · Quality: Good           │
└─────────────────────────────────────────────┘
```
- Language selector dropdown (if auto-detect was wrong)
- "Connect Human Interpreter" calls `POST /api/agencies/${agencyId}/incidents/${id}/interpreter`
  with `{ method: 'live_phone_interpreter', language: 'es', serviceProvider: 'convey911' }`
- "ASL Video Interpreter" opens a video panel (same video infrastructure as KVS)
  with `{ method: 'video_asl', language: 'asl' }`
- Session timer starts on connect
- Quality selector: Good / Fair / Poor (logged on disconnect)
- Disconnect button

**Convey911 adapter integration:**
When serviceProvider is `convey911`, the Lambda calls the Convey911 API:
```typescript
// apps/api/src/adapters/convey911-adapter.ts
// Create this file with the adapter class from the session's earlier spec
// Wire into requestInterpreter Lambda handler
```

**language-access-client.tsx spec (reports page):**
- Date range picker
- Monthly summary: total interactions, languages, adequate access %, total minutes
- By language: bar chart of interaction count per language
- Table: all LEP records — incident, language, method, duration, adequate access flag
- Export to CSV button for ADA/LEP compliance reporting
- Agency compliance score (% of interactions with adequate access)

**Acceptance criteria:**
- [ ] InterpreterPanel appears on language detection
- [ ] Human interpreter connects via Convey911 (requires CONVEY911_API_KEY in Secrets Manager)
- [ ] ASL video session opens correctly
- [ ] Session duration is logged
- [ ] LEP compliance report generates with correct totals

---

### 1.8 — Evidence Chain of Custody UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/evidence/page.tsx
apps/web/app/(app)/[agencySlug]/evidence/evidence-client.tsx
apps/web/components/dispatch/EvidencePanel.tsx
```

**evidence-client.tsx spec:**

**Filter bar:** By incident, date range, evidence type, status (active / hold / released)

**Evidence table columns:**
- Incident ID (links to incident)
- Type badge (photo / video / audio / transcript / document)
- Source (caller upload / dispatcher capture / system generated)
- Upload date
- Status badge with color
- Chain length (number of custody entries)
- [View] button

**Detail view (drawer):**
- Evidence preview (photo/video embedded, audio player, PDF viewer)
- SHA-256 hash displayed (integrity indicator)
- Status banner: Active / Under Hold / Released / Redacted
- [Place Hold] button → reason field + confirms
- Chain of custody timeline:
  - Each entry: action icon, user name/role, purpose, timestamp, IP
  - Created entry is always first
  - View / Download / Share entries show who accessed
- Public Records Requests section:
  - List of requests with status
  - [New Request] button → form: requestor name, org, email, due date, redaction required
  - Update status button per request
- Retention info: purge date, days remaining

**EvidencePanel.tsx spec (inline in incident view):**
- Shows count of evidence items attached to current incident
- Quick-add: photo/video upload button
- Thumbnail grid of attached media
- Click thumbnail → opens evidence viewer with chain of custody

**Acceptance criteria:**
- [ ] Evidence list with filters loads correctly
- [ ] Chain of custody timeline displays all entries
- [ ] Legal hold can be placed and prevents purge
- [ ] Public records requests can be created and tracked
- [ ] Evidence panel in incident view shows thumbnails

---

### 1.9 — Pre-Hire Assessment Portal UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/settings/assessments/page.tsx
apps/web/app/(app)/[agencySlug]/settings/assessments/assessments-client.tsx
apps/web/app/assess/[sessionId]/page.tsx
apps/web/app/assess/[sessionId]/assessment-session-client.tsx
```

**assessments-client.tsx spec (admin panel):**

**Tab: Manage Assessments**
- [Create Assessment Session] button → form:
  - Applicant name, email
  - Select scenarios (multi-select from agency + system scenarios)
  - Session expires in (days)
  - Submit → sends email invite to applicant
- Table of sessions: applicant name, status badge, score, passed/failed, created, expires
- Click row → session detail:
  - Per-scenario score breakdown
  - AI evaluation text per scenario
  - Actions completed vs missed
  - Time to first action
  - [Mark Reviewed] button + notes field

**Tab: Scenarios**
- System scenarios (read-only, locked icon)
- Agency custom scenarios
- [Create Scenario] button → form:
  - Title, description, call type, difficulty level
  - Upload caller audio (presigned S3 upload)
  - Expected actions list (drag to reorder):
    - Action description, weight (0–100), required flag, timeframe seconds
  - Rubric categories and weights
  - Duration (seconds)
  - Tags for filtering

**assessment-session-client.tsx spec (applicant-facing, public route):**

No auth required (session token in URL validates access):
- Welcome screen with instructions
- Scenario player:
  - Audio plays call recording
  - Timer counting up
  - Action checklist (applicant clicks actions as they complete them)
  - Free text notes field
  - [Complete Scenario] button
- Progress: Scenario 1 of 3, etc.
- Completion screen with "Thank you" message (no score shown to applicant)

**Acceptance criteria:**
- [ ] Admin can create session and applicant receives email
- [ ] Applicant can access session via link without logging in
- [ ] Scenario audio plays, actions are checkable
- [ ] Score calculated on completion
- [ ] Admin can review session with AI evaluation

---

### 1.10 — After-Action Learning Dashboard UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/supervisor/learning/page.tsx
apps/web/app/(app)/[agencySlug]/supervisor/learning/learning-client.tsx
```

**learning-client.tsx spec:**

**Impact overview strip (top):**
- Cards: New Patterns, High Impact, In Remediation, Resolved
- "Last analysis run: [date]"

**Patterns list:**
- Sorted by impact score (high first)
- Each pattern card:
  - Title + type badge
  - Impact score: colored ring (red 80+, amber 50-79, green <50)
  - Frequency: "23 occurrences · last 30 days"
  - Status badge: New / Acknowledged / In Remediation / Resolved / Monitoring
  - Evidence snippets (anonymized, expandable)
  - Root cause hypothesis (italic, AI-generated)
  - [Acknowledge] button if status = new
  - Status update dropdown

**Recommendations panel (right side or below each pattern):**
- Per recommendation:
  - Type icon (training / protocol / coaching / config)
  - Title and description
  - Priority badge
  - Estimated effort
  - [Mark Complete] button
  - If linkedScenarioId → [Open Scenario] button

**PIR Insights section (separate tab or scroll):**
- Quarterly insight cards generated from PIR data
- Theme, summary, affected period
- Recommendation list
- Impact level badge

**Acceptance criteria:**
- [ ] Patterns load sorted by impact score
- [ ] Acknowledge and status update work
- [ ] Recommendations show with correct type icons
- [ ] PIR insights display with period context

---

### 1.11 — Event Preparedness Calendar UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/supervisor/events/page.tsx
apps/web/app/(app)/[agencySlug]/supervisor/events/events-client.tsx
```

**events-client.tsx spec:**

**Calendar view (top half):**
- Month view calendar
- Events appear as colored blocks on their dates
- Color by type: sporting (blue), concert (purple), festival (green), weather (amber), other (gray)
- Click event → drawer with full event detail

**Upcoming events list (bottom half):**
- Sorted by date ascending
- Each event card:
  - Name, type badge, venue, date/time, expected attendance
  - Surge model: predicted additional calls with confidence range
  - Call type breakdown: "EMS: 12 · LAW: 8 · TRAFFIC: 6"
  - Peak hour
  - Model basis text
  - Staffing recommendations:
    - Each rec: role, additional staff needed, shift window, priority badge, justification
  - [Mark Acknowledged] button

**[Add Event] button → form:**
- Name, type, venue, address, expected attendance
- Start and end datetime
- Source URL (public permit or calendar link)
- Submit → auto-generates surge model, shows recommendations

**Acceptance criteria:**
- [ ] Calendar renders events on correct dates
- [ ] Surge model shows with confidence interval
- [ ] Staffing recommendations display with justification
- [ ] New event form generates surge model on submit

---

### 1.12 — Responder Safety Check-in UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/operations/check-in/page.tsx
apps/web/app/(app)/[agencySlug]/operations/check-in/check-in-client.tsx
apps/web/components/dispatch/CheckInTimerWidget.tsx
```

**check-in-client.tsx spec:**

**Active timers panel:**
- Live-updating list (WebSocket type `CHECKIN_UPDATE`)
- Each timer card:
  - Unit name (large), incident address
  - Countdown timer (red when <2 minutes, pulsing red when expired)
  - Status: Active / Checked In / Escalated / Cancelled
  - Dispatcher who started it
  - [Check In Unit] button (for supervisor override)
  - [Cancel Timer] button
  - If escalated: "ESCALATION LEVEL: SUPERVISOR ALERT" banner

**Active panic alerts panel (if any):**
- Red alert banner at top of page
- Unit name, location (lat/lon map pin link), triggered at
- [Acknowledge] button
- [Resolved] button

**[Start Check-in Timer] button:**
- Select unit from list
- Select duration: 5 / 10 / 15 / 30 minutes
- Linked incident (optional)
- Incident address (pre-fills if incident linked)
- Escalation contacts (auto-populated from agency config, editable)

**CheckInTimerWidget.tsx spec (inline in dispatch view):**
- Small widget in dispatcher toolbar
- Shows count of active timers
- Click → mini panel showing active timer list
- Quick [Start Timer] flow (select unit + duration in 2 steps)
- Timer expiry appears as push notification in the app

**Acceptance criteria:**
- [ ] Timers display with live countdown
- [ ] Countdown turns red below 2 minutes
- [ ] Check-in button marks timer complete
- [ ] Panic alerts display prominently with red banner
- [ ] Widget visible in dispatcher toolbar

---

### 1.13 — Social Awareness Feed UI

**Files to create:**
```
apps/web/app/(app)/[agencySlug]/supervisor/social/page.tsx
apps/web/app/(app)/[agencySlug]/supervisor/social/social-client.tsx
```

**social-client.tsx spec:**

**Urgency tabs:** All | Critical | High | Medium | Low  
**Status filter:** Unreviewed | Reviewed | Corroborated | Dismissed | Linked

**Signal feed (left panel):**
- Cards sorted by urgency then time
- Each signal card:
  - Urgency badge: CRITICAL (red pulsing) / HIGH (amber) / MEDIUM (yellow) / LOW (gray)
  - Signal type icon + label (shooting / fire / flooding / etc.)
  - Source badge: Source name (Twitter/X, Nextdoor, Ring, etc.)
  - AI summary (1 sentence, prominent)
  - Location: address or "Near [neighborhood]"
  - Confidence: "AI Confidence: 78%"
  - Detected: relative time ("4 minutes ago")
  - Status badge
  - [Review] button → marks as reviewed + opens action panel
  - [Dismiss] button → requires reason

**Action panel (right, appears on Review):**
- Signal summary
- Raw text (truncated, [Show full] toggle)
- Source URL (external link icon)
- Map pin showing location
- [Link to Incident] → incident ID text field → calls link endpoint
- [Dismiss] → reason dropdown:
  - "Unrelated to jurisdiction"
  - "Already handled"
  - "False information"
  - "Duplicate signal"
- [Corroborate] → marks as verified, links to incident

**Status page note:**
- "Social signals auto-purge after 48 hours"
- Source disclaimer: "Signals are AI-classified social media posts. 
  Verify before acting. Not a replacement for 911."

**Acceptance criteria:**
- [ ] Feed loads with urgency tabs
- [ ] Critical signals pulse red
- [ ] Review, dismiss, corroborate, link actions all work
- [ ] Signals disappear from unreviewed tab after action
- [ ] Source disclaimer is always visible

---

### 1.14 — Navigation Registration

**File to modify:** `apps/web/components/nav/agency-nav.tsx` (or wherever the 
main agency navigation is defined)

**Add the following nav items to the existing navigation structure:**

```typescript
// Operations group (add to existing operations section)
{ href: '/operations/mutual-aid',  label: 'Mutual Aid',     icon: 'Radio',      roles: ['DISPATCHER','SUPERVISOR','AGENCY_ADMIN'] },
{ href: '/operations/mci',         label: 'MCI Command',    icon: 'AlertTriangle', roles: ['DISPATCHER','SUPERVISOR','AGENCY_ADMIN'] },
{ href: '/operations/check-in',    label: 'Responder Safety', icon: 'Shield',   roles: ['DISPATCHER','SUPERVISOR','AGENCY_ADMIN'] },

// Supervisor group (add to existing supervisor section)
{ href: '/supervisor/learning',    label: 'Learning Engine', icon: 'Activity',  roles: ['SUPERVISOR','AGENCY_ADMIN'] },
{ href: '/supervisor/events',      label: 'Event Prep',      icon: 'Calendar',  roles: ['SUPERVISOR','AGENCY_ADMIN'] },
{ href: '/supervisor/social',      label: 'Social Awareness', icon: 'Globe',    roles: ['SUPERVISOR','AGENCY_ADMIN'] },

// Evidence (add to existing reports section)
{ href: '/evidence',               label: 'Evidence',        icon: 'FileText',  roles: ['DISPATCHER','SUPERVISOR','AGENCY_ADMIN'] },
{ href: '/reports/language-access', label: 'Language Access', icon: 'Globe',   roles: ['SUPERVISOR','AGENCY_ADMIN'] },

// Settings group (add to existing settings section)
{ href: '/settings/citizen-registry',   label: 'Citizen Registry',  icon: 'Users',  roles: ['AGENCY_ADMIN'] },
{ href: '/settings/address-intelligence', label: 'Address Intel',   icon: 'MapPin', roles: ['AGENCY_ADMIN','SUPERVISOR'] },
{ href: '/settings/alt-response',        label: 'Alt Response',     icon: 'Zap',    roles: ['AGENCY_ADMIN','SUPERVISOR'] },
{ href: '/settings/infrastructure',      label: 'Infrastructure',   icon: 'Building2', roles: ['AGENCY_ADMIN'] },
{ href: '/settings/assessments',         label: 'Pre-Hire',         icon: 'CheckCircle', roles: ['AGENCY_ADMIN'] },
```

**Acceptance criteria:**
- [ ] All 13 routes appear in correct navigation groups
- [ ] Role-based visibility works (dispatchers see operations, not settings)
- [ ] Active route is highlighted correctly

---

## SECTION 2: SOCIAL INGESTION WORKER

**Context:** Feature 13's `ingestSocialSignal` handler is complete but the 
polling workers that actually call external APIs don't exist.

**Strategy:** Start with Ring Neighbors (has agency API program), Nextdoor 
(Neighbors App program), and a generic RSS/webhook approach. Skip Twitter/X 
enterprise API until budget is confirmed. Bluesky has a free API.

---

### 2.1 — Bluesky Ingestion Worker

**File to create:**
```
apps/api/src/workers/social/bluesky-ingestion-worker.ts
```

**Spec:**
```typescript
/**
 * bluesky-ingestion-worker.ts
 * Polls Bluesky (AT Protocol) public posts within the agency's 
 * jurisdiction for emergency-relevant signals.
 * 
 * Bluesky API is free and public — no enterprise access required.
 * Rate limit: 3,000 requests/5 min (use with care).
 * 
 * Scheduled: every 2 minutes via EventBridge
 */

import type { ScheduledHandler } from 'aws-lambda';
import { AppBskyFeedSearchPosts } from '@atproto/api';

// Search terms that indicate emergency-relevant posts
const EMERGENCY_SEARCH_TERMS = [
  'shooting', 'shots fired', 'fire', 'accident', 'crash', 'flooding',
  'gas leak', 'power outage', 'emergency', 'help needed', 'trapped',
  '911', 'first responders', 'police', 'ambulance', 'fire truck',
];

export const handler: ScheduledHandler = async () => {
  // Load agency configs from DynamoDB (jurisdiction lat/lon, radius, enabled flag)
  // For each agency with social awareness enabled:
  //   For each search term:
  //     Call Bluesky search API: GET https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts
  //     Filter posts within agency jurisdiction radius (use geohash)
  //     For each relevant post:
  //       Call POST /api/agencies/${agencyId}/social/ingest with:
  //         source: 'bluesky'
  //         rawText: post.record.text
  //         location: (extract from post if present)
  //         sourceUrl: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
  //   Deduplicate by sourceUrl (check DDB before inserting)
};
```

**Key implementation notes:**
- Use `@atproto/api` npm package (already likely in deps, add if not)
- Posts do not always have geo-tags — use keyword-based location hints
  to estimate jurisdiction (e.g., post mentions city name in agency's city list)
- Store last-polled timestamp in DynamoDB to avoid re-processing old posts
- Add `SOCIAL_BLUESKY_ENABLED` feature flag per agency

---

### 2.2 — Ring Neighbors Agency API Worker

**File to create:**
```
apps/api/src/workers/social/ring-neighbors-worker.ts
```

**Spec:**
Ring has a public safety agency portal at `https://ring.com/public-safety`.
Once enrolled, agencies receive a webhook push when relevant posts are made 
in their jurisdiction. Build a webhook receiver, not a polling worker.

```typescript
/**
 * ring-neighbors-worker.ts
 * Receives webhook pushes from Ring Neighbors Agency API.
 * 
 * Setup required:
 * 1. Apply for Ring Neighbors Public Safety program at ring.com/public-safety
 * 2. Configure webhook endpoint in Ring agency portal:
 *    POST /api/webhooks/ring-neighbors
 * 3. Store Ring webhook secret in Secrets Manager as:
 *    nexcortiq/social/ring-neighbors-webhook-secret
 * 
 * Ring sends JSON payloads with: title, description, location (geojson), 
 * category, posted_at, and a sanitized URL.
 */

export const ringNeighborsWebhookHandler: APIGatewayProxyHandlerV2 = async (event) => {
  // 1. Validate Ring webhook signature from X-Ring-Signature header
  // 2. Parse payload
  // 3. Determine which agency's jurisdiction this falls in (geospatial lookup)
  // 4. Call ingestSocialSignal for the matched agency
  // Return 200 immediately (Ring requires <5s response)
};
```

---

### 2.3 — Nextdoor Integration

**File to create:**
```
apps/api/src/workers/social/nextdoor-worker.ts
```

**Spec:**
Nextdoor has a Neighbors App (same as Ring's program).
Apply at: `https://help.nextdoor.com/s/article/About-Nextdoor-for-Public-Agencies`
This is also a webhook-push model when agencies are enrolled.
Build a webhook receiver with the same pattern as Ring.

Build a stub webhook handler now and add a `TODO: Pending Nextdoor 
agency enrollment` comment. This allows the SAM route to be deployed 
and the endpoint to be registered when enrollment completes.

---

### 2.4 — SAM Route Registration for Social Workers

**File to modify:**
```
stack-app-sam-features.yaml (or the main app SAM template)
```

Add:
```yaml
# Bluesky polling — every 2 minutes
BlueskyIngestionFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "nexcortiq-social-bluesky-${Stage}"
    Handler: workers/social/bluesky-ingestion-worker.handler
    Timeout: 60
    Events:
      Poll:
        Type: Schedule
        Properties:
          Schedule: "rate(2 minutes)"
    Environment:
      Variables:
        SOCIAL_SIGNALS_TABLE: !Ref SocialSignalsTable
        SOCIAL_ALERT_SNS_TOPIC: !Ref SocialAlertTopic
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref SocialSignalsTable
      - SNSPublishMessagePolicy:
          TopicName: !GetAtt SocialAlertTopic.TopicName

# Ring Neighbors webhook receiver
RingNeighborsWebhookFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "nexcortiq-social-ring-webhook-${Stage}"
    Handler: workers/social/ring-neighbors-worker.ringNeighborsWebhookHandler
    Timeout: 10
    Events:
      Webhook:
        Type: Api
        Properties:
          Path: /webhooks/ring-neighbors
          Method: post
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref SocialSignalsTable
      - Statement:
          - Effect: Allow
            Action: [secretsmanager:GetSecretValue]
            Resource: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:nexcortiq/social/*"

# Nextdoor webhook receiver (stub — pending enrollment)
NextdoorWebhookFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "nexcortiq-social-nextdoor-webhook-${Stage}"
    Handler: workers/social/nextdoor-worker.nextdoorWebhookHandler
    Timeout: 10
    Events:
      Webhook:
        Type: Api
        Properties:
          Path: /webhooks/nextdoor
          Method: post
```

**Acceptance criteria:**
- [ ] Bluesky worker polls and ingests posts for test jurisdiction
- [ ] Ring webhook receiver validates signature and ingests signal
- [ ] Nextdoor stub returns 200 with TODO log message
- [ ] All three functions deploy without error

---

## SECTION 3: CHECK-IN EXPIRY LAMBDA (COMPLETE IMPLEMENTATION)

**Context:** The existing `checkExpiredTimers` handler only logs. A dispatcher 
safety feature that silently fails is a liability.

**File to modify:**
```
apps/api/src/handlers/training-predictive-safety.ts
```

**Replace the `checkExpiredTimers` stub with this complete implementation:**

```typescript
export const checkExpiredTimers: ScheduledHandler = async () => {
  const now = new Date().toISOString();
  const nowUnix = Math.floor(Date.now() / 1000);

  // Query CheckinTable GSI for active timers that have expired
  // GSI: pk=AGENCY#{agencyId}, sk=expiresAt
  // We need to scan active agencies and check each
  
  // Step 1: Get list of active agencies (from agency table or env var)
  const activeAgencyIds = await getActiveAgencyIds();
  
  for (const agencyId of activeAgencyIds) {
    // Step 2: Query active timers whose expiresAt <= now
    const expiredTimers = await ddb.send(new QueryCommand({
      TableName: T.checkin,
      IndexName: 'expiry-index',
      KeyConditionExpression: 'pk = :pk AND expiresAt <= :now',
      FilterExpression: '#status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `AGENCY#${agencyId}`,
        ':now': now,
        ':active': 'active',
      },
    }));

    for (const timer of (expiredTimers.Items ?? []) as CheckInTimer[]) {
      await handleExpiredTimer(timer, agencyId);
    }
  }
};

async function handleExpiredTimer(timer: CheckInTimer, agencyId: string): Promise<void> {
  const now = new Date().toISOString();

  // Determine escalation level
  const minutesExpired = Math.floor((Date.now() - new Date(timer.expiresAt).getTime()) / 60000);
  const escalationLevel: EscalationLevel = minutesExpired < 5
    ? 'supervisor_alert'
    : minutesExpired < 10
      ? 'backup_dispatch'
      : 'emergency_response';

  // Update timer status to escalated
  await ddb.send(new UpdateCommand({
    TableName: T.checkin,
    Key: { pk: `AGENCY#${agencyId}`, sk: `TIMER#${timer.timerId}` },
    UpdateExpression: 'SET #status = :s, escalationLevel = :el, escalationStartedAt = :now',
    ConditionExpression: '#status = :active', // Only escalate if still active
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':s': 'escalated',
      ':el': escalationLevel,
      ':now': now,
      ':active': 'active',
    },
  }));

  // Notify escalation contacts in order
  for (const contact of timer.escalationContacts.sort((a, b) => a.order - b.order)) {
    await notifyEscalationContact(contact, timer, agencyId, escalationLevel);
  }

  // Create panic alert record if emergency_response level
  if (escalationLevel === 'emergency_response') {
    const alert: PanicAlert = {
      pk: `AGENCY#${agencyId}`,
      sk: `PANIC#${randomUUID()}`,
      alertId: randomUUID(),
      agencyId,
      unitId: timer.unitId,
      unitName: timer.unitName,
      triggeredBy: 'timer_expired',
      incidentId: timer.incidentId,
      status: 'active',
      triggeredAt: now,
      ttl: Math.floor(Date.now() / 1000) + 86400,
    };
    await ddb.send(new PutCommand({ TableName: T.checkin, Item: alert }));
  }

  // Push WebSocket alert to all supervisors in the agency
  // Use existing WebSocket infrastructure
  await pushWebSocketAlert(agencyId, {
    type: 'CHECKIN_EXPIRED',
    payload: {
      timerId: timer.timerId,
      unitId: timer.unitId,
      unitName: timer.unitName,
      incidentAddress: timer.incidentAddress,
      escalationLevel,
      expiredAt: timer.expiresAt,
    },
  });

  console.log(`[CHECKIN-EXPIRY] Timer ${timer.timerId} escalated: ${timer.unitName} — level: ${escalationLevel}`);
}

async function notifyEscalationContact(
  contact: EscalationContact,
  timer: CheckInTimer,
  agencyId: string,
  level: EscalationLevel,
): Promise<void> {
  const message = `⚠️ RESPONDER CHECK-IN OVERDUE\nUnit: ${timer.unitName}\nLocation: ${timer.incidentAddress ?? 'Unknown'}\nExpired: ${timer.expiresAt}\nEscalation: ${level.replace('_', ' ').toUpperCase()}`;

  if (contact.method === 'sms' || contact.method === 'phone') {
    await sns.send(new PublishCommand({
      TopicArn: process.env.PANIC_ALERT_SNS_TOPIC!,
      Message: message,
      Subject: `RESPONDER OVERDUE — ${timer.unitName}`,
      MessageAttributes: {
        agencyId: { DataType: 'String', StringValue: agencyId },
        unitId: { DataType: 'String', StringValue: timer.unitId },
        escalationLevel: { DataType: 'String', StringValue: level },
        contactMethod: { DataType: 'String', StringValue: contact.method },
        contactValue: { DataType: 'String', StringValue: contact.contactValue },
      },
    }));
  }
}

async function getActiveAgencyIds(): Promise<string[]> {
  // Option A: Read from env var (comma-separated, set at deploy time)
  if (process.env.ACTIVE_AGENCY_IDS) {
    return process.env.ACTIVE_AGENCY_IDS.split(',').filter(Boolean);
  }
  // Option B: Query agency table (preferred for production)
  // Add scan of agencies table here when available
  return [];
}

// Import pushWebSocketAlert from existing WebSocket utility
// This function should already exist in your codebase at:
// apps/api/src/utils/websocket.ts
async function pushWebSocketAlert(agencyId: string, payload: unknown): Promise<void> {
  // Use existing WebSocket push infrastructure
  // Same pattern as cad-share-delivery.ts pushToAgencyConsoles
}
```

**Acceptance criteria:**
- [ ] Expired timers are detected within 1 minute of expiry
- [ ] SNS notification fires to escalation contacts
- [ ] Timer status updates to 'escalated' in DynamoDB
- [ ] Panic alert is created for emergency_response level
- [ ] WebSocket push alerts supervisors in the app
- [ ] Completed timers and already-escalated timers are not re-processed (ConditionExpression)

---

## SECTION 4: INTEGRATION WIRE-UPS

### 4.1 — Wire: Incident Close → Address Intelligence

**File to modify:** Find your existing incident-close Lambda.  
Search for: `eventName: 'INCIDENT_CLOSED'` or `status: 'closed'` in the handlers directory.

**Add this call at the end of the incident-close handler, after status update succeeds:**

```typescript
// At the top of the file, import:
import { depositIncidentIntelligence } from './citizen-intelligence';
// Or if calling via API internally:
// Call the depositIncidentIntelligence Lambda directly via Lambda invoke or HTTP

// After incident status is set to 'closed':
if (incident.location?.address && incident.location?.lat && incident.location?.lon) {
  await depositIncidentIntelligence({
    // Construct synthetic APIGatewayProxyHandlerV2 event, or call directly:
    address: {
      street: incident.location.address,
      city: incident.location.city ?? '',
      state: incident.location.state ?? '',
      zip: incident.location.zip ?? '',
    },
    incidentId: incident.incidentId,
    incidentType: incident.incidentType,
    priority: incident.priority,
    disposition: incident.disposition,
    notes: undefined, // Do not include PII from narrative
    lat: incident.location.lat,
    lon: incident.location.lon,
  }).catch(e => console.warn('[INCIDENT-CLOSE] Address intel deposit failed (non-blocking):', e));
  // Non-blocking: address intel enrichment failure should not block incident close
}
```

---

### 4.2 — Wire: Transcript Analysis → Alternative Response

**File to modify:** Find your existing transcript analysis Lambda.  
Search for: `TranscriptChunk`, `addTranscriptChunk`, or `analyzeTranscript` in the handlers.

**Add this call after each segment is analyzed:**

```typescript
import { evaluateAlternativeResponse } from './response-routing';

// After transcript segment is stored and AI analysis is complete:
// Accumulate the last N segments into a running transcript string
const recentTranscript = transcriptSegments
  .slice(-10) // Last 10 segments for context
  .map(s => `${s.speaker}: ${s.text}`)
  .join('\n');

// Only evaluate every 5th segment to avoid hammering (or on caller speech segments only)
if (segmentIndex % 5 === 0 || segment.speaker === 'CALLER') {
  evaluateAlternativeResponse({
    // Construct event body:
    body: JSON.stringify({
      agencyId,
      incidentId,
      transcript: recentTranscript,
      callType: incident.incidentType,
    }),
  } as any).catch(e => console.warn('[TRANSCRIPT] Alt response eval failed (non-blocking):', e));
  // Non-blocking: evaluation failure should not affect transcript processing
}
```

---

### 4.3 — Fix: getMCIEvent null return

**File to modify:**
```
apps/api/src/handlers/command-call-enhancement.ts
```

**Replace the `getMCIEvent` stub:**

```typescript
// Add mciId GSI to MCITable in SAM template:
// GlobalSecondaryIndexes:
//   - IndexName: mci-id-index
//     KeySchema:
//       - { AttributeName: mciId, KeyType: HASH }
//     Projection: { ProjectionType: KEYS_ONLY }  -- we just need pk to fetch the full item

async function getMCIEvent(mciId: string): Promise<MCIEvent | null> {
  // Step 1: Look up agencyId via GSI
  const gsiRes = await ddb.send(new QueryCommand({
    TableName: T.mci,
    IndexName: 'mci-id-index',
    KeyConditionExpression: 'mciId = :id',
    ExpressionAttributeValues: { ':id': mciId },
    Limit: 1,
  }));

  if (!gsiRes.Items?.[0]) return null;
  const { pk } = gsiRes.Items[0] as { pk: string };
  const agencyId = pk.replace('AGENCY#', '');

  // Step 2: Fetch the full item
  const res = await ddb.send(new GetCommand({
    TableName: T.mci,
    Key: { pk: `AGENCY#${agencyId}`, sk: `MCI#${mciId}` },
  }));

  return (res.Item as MCIEvent) ?? null;
}
```

**Also add the mciId attribute and GSI to MCITable in stack-app-sam-features.yaml:**
```yaml
# Under MCITable AttributeDefinitions, add:
- { AttributeName: mciId, AttributeType: S }

# Under MCITable GlobalSecondaryIndexes, add:
- IndexName: mci-id-index
  KeySchema:
    - { AttributeName: mciId, KeyType: HASH }
  Projection: { ProjectionType: KEYS_ONLY }
```

---

### 4.4 — Fix: CitizensTable address GSI

**File to modify:** `stack-app-sam-features.yaml`

The `lookupCitizen` handler queries a GSI named `address-index` on `normalizedAddress`.
This GSI must exist in the table definition.

**Under CitizensTable AttributeDefinitions, verify these exist (add if missing):**
```yaml
AttributeDefinitions:
  - { AttributeName: pk, AttributeType: S }
  - { AttributeName: sk, AttributeType: S }
  - { AttributeName: normalizedAddress, AttributeType: S }  # ADD THIS

GlobalSecondaryIndexes:
  - IndexName: address-index                                # ADD THIS GSI
    KeySchema:
      - { AttributeName: normalizedAddress, KeyType: HASH }
    Projection: { ProjectionType: ALL }
```

**Also update `registerCitizen` handler to set `normalizedAddress` on every put:**
```typescript
// In registerCitizen, before the PutCommand, add:
const normalizedAddress = profile.address
  ? `${profile.address.street.toLowerCase().trim()},${profile.address.city.toLowerCase().trim()},${profile.address.state.toLowerCase().trim()},${profile.address.zip.trim()}`
  : undefined;

// Add to the profile object:
const profileWithAddress: CitizenProfile = {
  ...profile,
  normalizedAddress,  // Add this field to the CitizenProfile type too
};
```

---

## SECTION 5: SECURITY & COMPLIANCE

### 5.1 — Customer-Managed KMS

**Files to modify:**
- Main app SAM template (wherever DynamoDB tables and S3 buckets are defined)
- `stack-app-sam-features.yaml`

**Add KMS parameter and wire it everywhere:**

```yaml
# In Parameters section of both SAM templates:
AgencyKMSKeyArn:
  Type: String
  Default: ""
  Description: "Customer-managed KMS key ARN for enterprise agencies. 
    Leave blank to use AWS-managed keys."

# Condition:
Conditions:
  UseCustomKMS: !Not [!Equals [!Ref AgencyKMSKeyArn, ""]]

# On every DynamoDB table, replace:
SSESpecification:
  SSEEnabled: true
# With:
SSESpecification:
  SSEEnabled: true
  SSEType: !If [UseCustomKMS, "KMS", "AES256"]
  KMSMasterKeyId: !If [UseCustomKMS, !Ref AgencyKMSKeyArn, !Ref AWS::NoValue]

# On every S3 bucket with SSE, replace:
ServerSideEncryptionByDefault:
  SSEAlgorithm: aws:kms
# With:
ServerSideEncryptionByDefault:
  SSEAlgorithm: aws:kms
  KMSMasterKeyId: !If [UseCustomKMS, !Ref AgencyKMSKeyArn, !Ref AWS::NoValue]
```

**Add to deploy2.sh:**
```bash
if [[ -n "${AGENCY_KMS_KEY_ARN:-}" ]]; then
  PARAMS="${PARAMS} AgencyKMSKeyArn=${AGENCY_KMS_KEY_ARN}"
fi
```

---

### 5.2 — SSO/SAML for Enterprise Agencies

**File to create:**
```
apps/api/src/handlers/agency-sso.ts
```

**Spec:**
```typescript
/**
 * agency-sso.ts
 * Configures per-agency SAML IdP in Cognito User Pool.
 * 
 * Called by agency admin when enabling SSO.
 * Required for county/state agencies on Active Directory.
 * 
 * Prerequisites:
 * 1. Agency provides: IdP metadata URL (or XML)
 * 2. NexCortiQ provides: SP entity ID and ACS URL to agency IT
 * 
 * SP entity ID: https://auth.nexcortiq.us/saml2/idpresponse
 * ACS URL: https://auth.nexcortiq.us/saml2/idpresponse
 */

import {
  CognitoIdentityProviderClient,
  CreateIdentityProviderCommand,
  UpdateIdentityProviderCommand,
  DeleteIdentityProviderCommand,
  DescribeIdentityProviderCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

export const configureSAML: APIGatewayProxyHandlerV2 = async (event) => {
  const { agencyId, role } = claims(event);
  if (role !== 'AGENCY_ADMIN') return err('Only Agency Admins can configure SSO', 403);
  
  const body = JSON.parse(event.body ?? '{}');
  const { metadataUrl, metadataXml, attributeMappings } = body;
  
  const providerName = `SAML-${agencyId}`;
  
  await cognito.send(new CreateIdentityProviderCommand({
    UserPoolId: process.env.COGNITO_USER_POOL_ID!,
    ProviderName: providerName,
    ProviderType: 'SAML',
    ProviderDetails: {
      ...(metadataUrl ? { MetadataURL: metadataUrl } : {}),
      ...(metadataXml ? { MetadataFile: metadataXml } : {}),
      IDPSignout: 'true',
    },
    AttributeMapping: {
      email: attributeMappings?.email ?? 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      name: attributeMappings?.name ?? 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      'custom:agencyId': attributeMappings?.agencyId ?? 'agencyId',
      'custom:role': attributeMappings?.role ?? 'role',
    },
  }));
  
  // Store SSO config in agency settings DynamoDB record
  // Update agency record: ssoEnabled: true, samlProviderName: providerName
  
  return ok({
    configured: true,
    providerName,
    spEntityId: `https://auth.nexcortiq.us/saml2/idpresponse`,
    acsUrl: `https://auth.nexcortiq.us/saml2/idpresponse`,
    message: 'SAML provider configured. Provide the SP Entity ID and ACS URL to your Identity Provider.',
  });
};
```

**Add SSO settings UI panel to:**
```
apps/web/app/(app)/[agencySlug]/settings/security/page.tsx
apps/web/app/(app)/[agencySlug]/settings/security/security-client.tsx
```

The security settings panel should include:
- SSO/SAML configuration section (admin only)
- IdP Metadata URL field OR XML upload
- Attribute mapping configuration (email, name, agencyId, role)
- Test SSO button (generates a test login URL)
- [Enable SSO] button with confirmation
- Status: SSO Active / SSO Inactive

---

### 5.3 — SIEM Integration (CloudWatch → Kinesis Firehose)

**File to modify:** Main app SAM template

```yaml
# Parameters:
SIEMEnabled:
  Type: String
  Default: "false"
  AllowedValues: ["true", "false"]
SIEMEndpointUrl:
  Type: String
  Default: ""
  Description: "HTTPS endpoint for Kinesis Firehose SIEM delivery (agency-provided)"

# Conditions:
SIEMActive: !Equals [!Ref SIEMEnabled, "true"]

# Resources:
SIEMDeliveryStream:
  Type: AWS::KinesisFirehose::DeliveryStream
  Condition: SIEMActive
  Properties:
    DeliveryStreamName: !Sub "nexcortiq-siem-${Stage}"
    DeliveryStreamType: DirectPut
    HttpEndpointDestinationConfiguration:
      EndpointConfiguration:
        Url: !Ref SIEMEndpointUrl
        Name: "AgencySIEM"
      RetryOptions:
        DurationInSeconds: 300
      S3BackupMode: FailedDataOnly
      S3Configuration:
        BucketARN: !Sub "arn:aws:s3:::nexcortiq-siem-backup-${Stage}"
        RoleARN: !GetAtt SIEMFirehoseRole.Arn
      RoleARN: !GetAtt SIEMFirehoseRole.Arn

SIEMLogSubscription:
  Type: AWS::Logs::SubscriptionFilter
  Condition: SIEMActive
  Properties:
    LogGroupName: !Sub "/aws/lambda/nexcortiq-api-${Stage}"
    FilterPattern: "[severity=ERROR, ...]"
    DestinationArn: !GetAtt SIEMDeliveryStream.Arn

SIEMFirehoseRole:
  Type: AWS::IAM::Role
  Condition: SIEMActive
  Properties:
    AssumeRolePolicyDocument:
      Statement:
        - Effect: Allow
          Principal: { Service: firehose.amazonaws.com }
          Action: sts:AssumeRole
    Policies:
      - PolicyName: SIEMFirehosePolicy
        PolicyDocument:
          Statement:
            - Effect: Allow
              Action: [logs:PutLogEvents, kinesis:PutRecord, kinesis:PutRecords]
              Resource: "*"
```

**Add to deploy2.sh:**
```bash
if [[ "${SIEM_ENABLED:-false}" == "true" ]]; then
  PARAMS="${PARAMS} SIEMEnabled=true"
  PARAMS="${PARAMS} SIEMEndpointUrl=${SIEM_ENDPOINT_URL}"
fi
```

---

### 5.4 — Verify CloudTrail

**File to modify:** Main app SAM template

Search for `EnableCloudTrail` parameter in the SAM template. If it exists but 
CloudTrail is not actually enabled by default, change the default to `true`:

```yaml
EnableCloudTrail:
  Type: String
  Default: "true"    # Change from "false" to "true" — CJIS requires this
  AllowedValues: ["true", "false"]
```

If CloudTrail resource is missing entirely, add:

```yaml
NexCortiQCloudTrail:
  Type: AWS::CloudTrail::Trail
  Condition: CloudTrailEnabled
  Properties:
    TrailName: !Sub "nexcortiq-${Stage}"
    S3BucketName: !Ref CloudTrailBucket
    IsLogging: true
    IsMultiRegionTrail: false
    EnableLogFileValidation: true
    EventSelectors:
      - ReadWriteType: All
        IncludeManagementEvents: true
        DataResources:
          - Type: AWS::DynamoDB::Table
            Values: ["arn:aws:dynamodb:::table/nexcortiq-*"]
          - Type: AWS::S3::Object
            Values: ["arn:aws:s3:::nexcortiq-evidence-*/*"]

CloudTrailBucket:
  Type: AWS::S3::Bucket
  Properties:
    BucketName: !Sub "nexcortiq-cloudtrail-${Stage}"
    VersioningConfiguration:
      Status: Enabled
    LifecycleConfiguration:
      Rules:
        - Status: Enabled
          ExpirationInDays: 2555  # 7-year retention (CJIS requirement)
```

---

## SECTION 6: OPERATIONAL INFRASTRUCTURE

### 6.1 — DLQ Review Workflow

**File to create:**
```
apps/api/src/workers/dlq-review-worker.ts
```

```typescript
/**
 * dlq-review-worker.ts
 * Monitors all DLQs across the platform.
 * 
 * Runs every 5 minutes. When messages are found in any DLQ:
 * 1. Publishes a CloudWatch metric: DLQMessageCount per queue
 * 2. Sends SNS alert to ops team with queue name and sample message
 * 3. Logs full message content for replay
 * 4. Provides an API endpoint for manual replay
 * 
 * CloudWatch alarm already fires when DLQ count >= 1.
 * This Lambda adds: alerting, logging, and replay capability.
 */

import type { ScheduledHandler, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, SendMessageCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sqs = new SQSClient({});
const cw  = new CloudWatchClient({});
const sns = new SNSClient({});

// All DLQ names — add any new ones here when new queues are created
const DLQ_NAMES = [
  `nexcortiq-cad-mesh-router-dlq-${process.env.STAGE}`,
  `nexcortiq-cad-mesh-dlq-${process.env.STAGE}-sample-agency.fifo`,
  // Feature queues — add pattern or enumerate
];

export const checkDLQs: ScheduledHandler = async () => {
  for (const queueName of DLQ_NAMES) {
    try {
      const urlRes = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
      if (!urlRes.QueueUrl) continue;

      const messages = await sqs.send(new ReceiveMessageCommand({
        QueueUrl: urlRes.QueueUrl,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 30,
        WaitTimeSeconds: 0,
      }));

      const count = messages.Messages?.length ?? 0;
      if (count === 0) continue;

      // Publish CloudWatch metric
      await cw.send(new PutMetricDataCommand({
        Namespace: 'NexCortiQ/DLQ',
        MetricData: [{
          MetricName: 'DLQMessageCount',
          Dimensions: [{ Name: 'QueueName', Value: queueName }],
          Value: count,
          Unit: 'Count',
        }],
      }));

      // Alert ops team
      const sampleBody = messages.Messages?.[0]?.Body?.slice(0, 500) ?? '';
      await sns.send(new PublishCommand({
        TopicArn: process.env.OPS_ALERTS_TOPIC_ARN!,
        Subject: `⚠️ DLQ Messages Found — ${queueName}`,
        Message: `Queue: ${queueName}\nMessages: ${count}\nSample:\n${sampleBody}\n\nTo replay, call POST /api/ops/dlq/replay with { queueName, receiptHandles }`,
      }));

      console.log(`[DLQ-REVIEW] ${queueName}: ${count} messages found`);
    } catch (e) {
      console.error(`[DLQ-REVIEW] Error checking ${queueName}:`, e);
    }
  }
};

/** Manual replay endpoint — supervisors/ops only */
export const replayDLQMessages: APIGatewayProxyHandlerV2 = async (event) => {
  // Validate ops token from Authorization header
  // Move messages from DLQ back to source queue
  // Log the replay action with timestamp and user
  return { statusCode: 200, body: JSON.stringify({ replayed: true }) };
};
```

**Add to SAM template:**
```yaml
DLQReviewFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub "nexcortiq-dlq-review-${Stage}"
    Handler: workers/dlq-review-worker.checkDLQs
    Events:
      Schedule:
        Type: Schedule
        Properties:
          Schedule: "rate(5 minutes)"
    Policies:
      - SQSPollerPolicy:
          QueueName: "nexcortiq-*-dlq-*"
      - CloudWatchPutMetricPolicy: {}
      - SNSPublishMessagePolicy:
          TopicName: !GetAtt OpsAlertsTopic.TopicName
```

---

### 6.2 — Incident Response Runbook

**File to create:**
```
docs/runbooks/incident-response.md
```

```markdown
# NexCortiQ Incident Response Runbook

**Last updated:** [DATE]  
**On-call rotation:** See PagerDuty schedule at [LINK]  
**Escalation:** Primary → Backup → Jeffrey Coleman (cell: stored in 1Password)

---

## Severity Definitions

| Severity | Description | Response Time | Who to Page |
|---|---|---|---|
| P0 | Platform down for active agencies | 15 min | Primary + Jeffrey |
| P1 | Core feature unavailable (dispatch, transcription) | 30 min | Primary |
| P2 | Non-critical feature degraded | 2 hours | Primary (next business day if P2 off-hours) |
| P3 | Monitoring alert, no user impact | Next business day | None |

---

## Runbook 1: Lambda Error Spike

**Alarm:** `nexcortiq-api-errors-[stage]`  
**Threshold:** >10 errors in 60 seconds

**Diagnosis:**
1. Open CloudWatch → Log Insights
2. Run: `fields @message | filter @message like /ERROR/ | sort @timestamp desc | limit 50`
3. Identify which Lambda function is failing
4. Check for: cold start timeouts, DynamoDB throttles, upstream API failures

**Resolution:**
- Timeout: Increase Lambda timeout in SAM template, deploy
- DDB throttle: Switch table to on-demand billing if on provisioned
- Upstream API: Check Convey911, AWS Transcribe, Bedrock status pages
- Unknown: Roll back last deploy: `bash scripts/fire-drill-rollback.sh`

---

## Runbook 2: DynamoDB Throttles

**Alarm:** `nexcortiq-ddb-throttles-[stage]`

**Diagnosis:**
1. CloudWatch → DynamoDB → ThrottledRequests by table
2. Identify which table and which operation (read/write)

**Resolution:**
- If table is on provisioned: switch to PAY_PER_REQUEST in SAM template → deploy
- If already on PAY_PER_REQUEST: hot partition key — review access patterns

---

## Runbook 3: Cognito Auth Failures

**Alarm:** CloudWatch Logs filter for `AUTH_FAILURE` or `TokenExpired`

**Diagnosis:**
1. Check Cognito User Pool → Sign-in activity
2. Look for: token expiry, MFA failures, pool misconfiguration

**Resolution:**
- Expired tokens: Force re-login (no code change)
- Pool misconfiguration: Check `COGNITO_USER_POOL_ID` env var in Lambda
- MFA failure spike: Check for brute force — enable CAPTCHA in Cognito
- SAML IdP down: Contact agency IT — IdP metadata may need refresh

---

## Runbook 4: Media Bucket Access Denied

**Alarm:** CloudWatch → S3 → 4xx errors on evidence or media buckets

**Diagnosis:**
1. Check S3 bucket policy for `nexcortiq-evidence-[stage]`
2. Check IAM role attached to the Lambda that uploads/downloads
3. Check: Object Lock configuration hasn't been broken

**Resolution:**
- Bucket policy: Verify no recent IAM changes — roll back if needed
- Lambda role: Ensure Lambda execution role has `s3:PutObject`, `s3:GetObject`
- Object Lock: Never modify Object Lock config — contact AWS Support

---

## Communication Template (P0/P1)

```
Subject: [NexCortiQ] [P0/P1] [Brief description] — [TIME UTC]

Agencies affected: [list or "all"]
Feature affected: [dispatch / transcription / all]
Status: INVESTIGATING / IDENTIFIED / RESOLVING / RESOLVED
Estimated resolution: [time or "unknown"]
Updates: every 15 minutes at status.nexcortiq.us

Next update: [TIME]
— NexCortiQ Ops
```

---

## Post-Incident Report Template

After every P0 or P1, complete within 48 hours:
- Timeline of events
- Root cause
- Customer impact (agencies affected, duration)
- Actions taken
- Permanent fix
- Process improvement
```

---

### 6.3 — Disaster Recovery Test Script

**File to create:**
```
scripts/disaster-recovery-test.sh
```

```bash
#!/usr/bin/env bash
# NexCortiQ Disaster Recovery Test
# Run quarterly — results must be attached to SOC 2 evidence package
# Usage: STAGE=dev bash scripts/disaster-recovery-test.sh

set -euo pipefail

STAGE="${STAGE:-dev}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_FILE="docs/dr-test-results/dr-test-${STAGE}-${TIMESTAMP}.md"

mkdir -p docs/dr-test-results

echo "# DR Test Results — ${STAGE} — ${TIMESTAMP}" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

log_result() {
  local test="$1" result="$2"
  echo "| ${test} | ${result} |" >> "$REPORT_FILE"
  echo "  ${test}: ${result}"
}

echo "## DynamoDB Point-in-Time Recovery" >> "$REPORT_FILE"
echo "| Test | Result |" >> "$REPORT_FILE"
echo "|---|---|" >> "$REPORT_FILE"

# Test 1: Verify PITR is enabled on all critical tables
for table in \
  "nexcortiq-cad-mesh-trust-${STAGE}" \
  "nexcortiq-evidence-${STAGE}" \
  "nexcortiq-citizens-${STAGE}" \
  "nexcortiq-cad-mesh-audit-${STAGE}"; do
  
  status=$(aws dynamodb describe-continuous-backups \
    --table-name "$table" \
    --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
    --output text 2>/dev/null || echo "TABLE_NOT_FOUND")
  
  log_result "PITR enabled: ${table}" "${status}"
done

# Test 2: Verify S3 versioning on evidence bucket
versioning=$(aws s3api get-bucket-versioning \
  --bucket "nexcortiq-evidence-${STAGE}" \
  --query 'Status' --output text 2>/dev/null || echo "BUCKET_NOT_FOUND")
log_result "S3 versioning: evidence bucket" "${versioning}"

# Test 3: CloudTrail is logging
trail_status=$(aws cloudtrail get-trail-status \
  --name "nexcortiq-${STAGE}" \
  --query 'IsLogging' --output text 2>/dev/null || echo "TRAIL_NOT_FOUND")
log_result "CloudTrail logging" "${trail_status}"

# Test 4: Smoke test after simulated failure (manual step)
echo "" >> "$REPORT_FILE"
echo "## Manual Verification Required" >> "$REPORT_FILE"
echo "- [ ] Tested DynamoDB restore from point-in-time to recovery table" >> "$REPORT_FILE"
echo "- [ ] Verified restored data matches expected state" >> "$REPORT_FILE"
echo "- [ ] Tested rollback via fire-drill-rollback.sh" >> "$REPORT_FILE"
echo "- [ ] Verified post-rollback smoke test passes" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Completed by:** [NAME]" >> "$REPORT_FILE"
echo "**Date:** $(date)" >> "$REPORT_FILE"
echo "**Sign-off:** [ ]" >> "$REPORT_FILE"

echo ""
echo "DR test automated checks complete. Report: ${REPORT_FILE}"
echo "Complete manual verification steps and sign off before filing."
```

---

## SECTION 7: ACCEPTANCE TEST (run after all sections complete)

**Run these commands in order:**

```bash
# 1. Build
npm run build

# 2. Type check
npm run typecheck

# 3. Cross-tenant isolation
bash scripts/run-cross-agency-isolation-test.sh

# 4. Post-deploy smoke
bash scripts/post-deploy-smoke.sh

# 5. DR test (automated portion)
STAGE=dev bash scripts/disaster-recovery-test.sh

# 6. Validate docs
bash scripts/validate-docs-deployment-readiness.sh

# 7. Audit mock flags
grep -rn "MOCK\|TODO.*prod\|PLACEHOLDER\|stub" apps/api/src --include="*.ts" | wc -l
# Target: 0 results in any file that is not explicitly behind a feature flag
```

**Final checklist before declaring complete:**
- [ ] All 13 feature UIs render without console errors
- [ ] Navigation routes for all 13 features load correctly
- [ ] Bluesky ingestion worker processes test posts
- [ ] Check-in timer fires SNS on expiry (test with 1-minute timer in dev)
- [ ] Incident close deposits into address intelligence (verify DDB record)
- [ ] Alternative response flag appears when MH phrases detected (test with transcript)
- [ ] getMCIEvent returns a real MCIEvent (not null) for existing MCI ID
- [ ] CitizensTable address-index GSI resolves lookups by address
- [ ] CloudTrail is logging in production (verify in AWS console)
- [ ] KMS parameter accepted in deploy script without error
- [ ] DLQ review Lambda alerts on test message in dev DLQ
- [ ] DR test report file generated and manual steps documented
- [ ] Incident response runbook committed to docs/
```
