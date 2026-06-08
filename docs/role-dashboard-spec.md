# Rapid Cortex — Role Dashboard UI/UX Specification

**All active roles — permissions, layout, and design**

> Canonical reference for dashboard isolation, navigation, widgets, and visual themes.
> Pair with `packages/security/src/role-access-matrix-v2.ts` (API permissions) and `.cursorrules` (engineering guardrails).

## How to use this document

Sections are ordered by risk and frequency of change:

1. **RC Internal** — platform operators (`rcsuperadmin`, `rcadmin`, `rcitadmin`)
2. **PSAP / Dispatch** — jurisdiction-scoped 911 workflows
3. **Campus** — school safety vertical (not PSAP)
4. **Hospital** — capacity/routing portal
5. **Venue** — event/arena operations vertical

### Design decisions that matter most

**PSAP vs vertical separation** — `dispatcher` / `supervisor` and `VENUE_*` / `CAMPUS_*` / `HOSPITAL_*` must be visually distinct. Header badge, color scheme, and navigation must make a wrong-dashboard situation obvious immediately. Campus and guest-services surfaces must never be mistaken for a 911 dispatch console.

**"Cannot" is absence, not gray-out** — If a role lacks permission, the UI element must not exist (no sidebar link, no widget, no action button). Grayed controls are only for *temporary* unavailability (e.g. no incident selected), never permanent RBAC denial.

### Implementation priorities (do these first)

1. **VENUE_GUEST_SERVICES** — Show explicit **"NOT A 911 EMERGENCY DISPATCH SYSTEM"** disclaimer on every page (liability, not optional UX).
2. **agencyadmin** — Must **not** have a live call workspace; landing on dispatcher view is an operational separation failure.
3. **rcsuperadmin Grants** — Time-boxed permission grants section is **roadmap only**; all other RC Admin sections exist today.
4. **RC Admin sidebar parity** — Implemented in `apps/web/lib/dashboards/rc-admin-role-nav.ts` (per-role nav, home redirect, route RBAC). **Campus users/settings nav** is next.

### Maintenance

- When **transit** vertical ships, add `TRANSIT_*` sections and remove "not built" notes from `.cursorrules`.
- When **HOSPITAL_COORDINATOR** gets a defined permission set in `packages/security`, align its "Permissions" block here.
- When **Stack 4** (`API_UPSTREAM_BASE_4`) is live, keep BFF routing table in `.cursorrules` aligned with `scripts/print-stack-outputs-for-web.sh`.
- After **og:image** dimensions are verified in production, add asset dimension rules here and in `.cursorrules`.

---

# SECTION 1 — RC INTERNAL ROLES

These roles operate the Rapid Cortex platform itself. They never see PSAP dispatch workspaces, venue operations, or campus consoles. Their dashboards are administration and business intelligence surfaces.

---

## rcsuperadmin — Platform Superadmin

**Implementation:** Sidebar nav from `rcAdminNavForRole("rcsuperadmin")` — home `/rc-admin/dashboard`; Feature flags at `/rc-admin/access` (superadmin-only); Settings at `/rc-admin/operations`. Grants nav item omitted until roadmap ships.

**Real-world identity:** CTO or senior platform engineer at Rapid Cortex. Owns the infrastructure, holds immutable permissions, and can grant any permission to any user for a time-boxed period with a mandatory reason.

**Dashboard URL:** `/rc-admin/dashboard`

**Visual theme:** Deep navy background, purple accent (`violet-600`), "PLATFORM — SUPERADMIN" badge in header. RC logo with no agency context shown. System status bar visible at all times at top of screen.

### Navigation sidebar
- Platform Overview (home)
- Agencies (all tenants, cross-account)
- Users (cross-tenant user management)
- Billing (all accounts, invoices, subscriptions)
- Infrastructure (health, alarms, Lambda errors)
- Audit Log (all tenants)
- Grants (time-boxed permission grants — superadmin only) **← roadmap**
- Platform Notices (broadcast to agencies)
- Feature Flags (system-wide toggles)
- Developer Portal (API clients, RC Lite keys)
- **Location QR Codes** (create, edit, bulk-import, download — all venues and campuses cross-tenant)
- Settings (immutable platform config)

### Home dashboard widgets
1. **Platform health bar** — real-time: Lambda error rate, API p99 latency, DynamoDB throttles, Cognito auth failures across all stacks
2. **Active agencies** — count by status (active, pilot, suspended, churned) with trend vs last 30 days
3. **New agency signups** — table of agencies created in last 7 days
4. **Active alerts** — any CloudWatch alarms in ALARM state across all nested stacks
5. **Active grants** — table of any time-boxed superadmin grants currently in effect **← roadmap**
6. **Platform notices** — any notices sent to agencies in last 30 days
7. **Revenue snapshot** — total MRR, plan distribution, pending invoices (read from billing)
8. **Integration health** — Ring Connect, CAD adapters, Bedrock, Transcribe — green/red per service

### Permissions
- All permissions (every row in the Role Access Matrix)
- Only role that can: issue/revoke/view time-boxed grants, manage feature flags, access billing revenue totals, delete incidents, delete transcripts, redact transcripts
- Cross-tenant scope on all data operations
- **Create, edit, bulk-import, deactivate, and download QR codes for any venue or campus tenant** — cross-tenant, no agencyId restriction

### Cannot
- Nothing. This role has no access restrictions within the platform.

---

## rcadmin — Business/Operations Admin

**Implementation:** Sidebar nav from `rcAdminNavForRole("rcadmin")` — home `/rc-admin/dashboard`; Service catalog `/rc-admin/billing/services`; Reports `/rc-admin/usage`; no Infrastructure, Feature flags, or Settings links. Agreements nav deferred until Adobe Sign surface ships.

**Real-world identity:** Account executive, customer success manager, or operations lead at Rapid Cortex. Creates agencies, manages billing, sends platform notices, manages agreements.

**Dashboard URL:** `/rc-admin/dashboard`

**Visual theme:** Same as rcsuperadmin but badge reads "PLATFORM — ADMIN". No Grants section visible. Feature Flags visible as read-only.

### Navigation sidebar
- Platform Overview (home)
- Agencies (onboard, view, manage)
- Users (view only cross-tenant — no deactivation of compromised accounts)
- Billing (manage all — invoices, subscriptions, POs, mark paid)
- Service Catalog (manage billable services)
- Platform Notices
- Developer Portal (API clients)
- Agreements (Adobe Sign management)
- **Location QR Codes** (create, edit, bulk-import, download — scoped to venue/campus tenants)
- Reports

### Home dashboard widgets
1. **Agency pipeline** — new this week, trials ending, pending renewals
2. **Billing health** — overdue invoices, draft invoices, upcoming renewals
3. **Platform notices sent** — last 30 days
4. **Service catalog** — active services by category
5. **Support escalations** — any pending (if integrated)

### Permissions
- Onboard new agencies
- Manage billing and subscriptions for all tenants
- Add/remove feature add-ons
- View usage dashboards (not revenue totals — that's superadmin only)
- Manage Adobe Sign agreements
- Manage developer portal and API clients
- Send platform notices
- View audit log across all tenants (not export)
- Create/update users across all tenants
- Reset passwords, unlock accounts, re-enroll MFA (as support)
- **Create, edit, bulk-import, deactivate, and download QR codes for any venue or campus tenant** — cross-tenant, scoped by the selected agency's agencyId in the UI

### Cannot
- Access feature flags
- Issue permission grants
- View financial revenue totals or billing CSV export
- Delete or redact any data
- Access platform infrastructure diagnostics

---

## rcitadmin — Infrastructure/IT Admin

**Implementation:** Sidebar nav from `rcAdminNavForRole("rcitadmin")` — home `/rc-admin/infrastructure` (index + dashboard redirect); System settings `/rc-admin/system-settings`; Security `/rc-admin/security`; CAD administration shares `/rc-admin/integrations`. No billing surfaces in sidebar.

**Real-world identity:** Platform DevOps engineer or infrastructure lead at Rapid Cortex. Manages technical operations, system settings, integration health, and provides technical user support across all tenants.

**Dashboard URL:** `/rc-admin/infrastructure`

**Visual theme:** Same navy but badge reads "PLATFORM — IT". Infrastructure monitoring is the primary surface, not business data.

### Navigation sidebar
- Infrastructure Overview (home)
- System Health (Lambda alarms, DynamoDB, ECS, CloudFront)
- Integrations (view + manage all tenant integrations)
- Users (cross-tenant — technical support only)
- Audit Log (view across tenants)
- System Settings (edit)
- CAD Administration (manage CAD adapters, webhooks, pollers)
- Security (MFA policy, CORS, WAF)
- **Location QR Codes** (create, edit, bulk-import, download — scoped to venue/campus tenants; supports setup and troubleshooting during agency onboarding)

### Home dashboard widgets
1. **System health grid** — all Lambda stacks (AppSam 1–4, QR, Alarms), ECS tasks, DataLayer, Cognito
2. **Integration status** — per integration type (CAD, Ring, Stripe, Bedrock, Transcribe) across all tenants
3. **Failed auth events (24h)** — suspicious login patterns across all tenants
4. **CAD writeback audit** — pending/failed writeback attempts
5. **Active API pollers** — per tenant, last poll time and status
6. **Recent alerts** — CloudWatch alarms in ALARM or INSUFFICIENT_DATA

### Permissions
- View and manage integrations across all tenants
- Manage system settings (edit)
- View and manage MFA policy
- Infrastructure diagnostics
- Cross-tenant technical user management (reset password, unlock, re-enroll MFA, resend invite, deactivate compromised)
- View login activity and failed auths
- View audit log and CAD writeback audit (no export)
- View all CAD integration config and test adapters
- **Create, edit, bulk-import, deactivate, and download QR codes for any venue or campus tenant** — cross-tenant, scoped by the selected agency's agencyId in the UI

### Cannot
- Manage billing or subscriptions
- Send platform notices
- Issue permission grants
- Export audit log
- Delete any incident or transcript data
- View financial data

---

# SECTION 2 — PSAP / DISPATCH ROLES

These roles operate inside a specific agency's jurisdiction workspace. Agency context is always visible in the header. All data is scoped strictly to their `agencyId`.

---

## dispatcher — Emergency Communications Officer

**Real-world identity:** The 911 call taker. Taking live calls, managing active incidents, submitting to CAD, communicating with callers. This is the highest-stress, highest-frequency user of the platform.

**Dashboard URL:** `/{jurisdiction}/dashboard`

**Visual theme:** Dark charcoal/navy, electric blue (`sky-600`) accents, monospace/high-legibility font option (Courier, Inter, Times New Roman, Arial — user-selectable). "SYSTEM NOMINAL" status badge top right. Clock and shift timer always visible. Designed for single-monitor or multi-monitor command center environments.

### Navigation sidebar
- Dashboard (live workspace — home)
- Dispatcher (call intake and active session)
- Intake (new call entry)
- Triage (call classification)
- Transcription (live transcript viewer)
- Incidents (queue)
- History (past calls)
- Media (caller video, live camera, text-to-caller)

### Home dashboard layout
**Primary workspace (center, full height):**
- **Active incident panel** — current call session: caller info, incident type badge, AI-suggested nature code, confidence indicator
- **Live transcript** — scrolling real-time transcript with auto-scroll toggle, language indicator, RTL support for Arabic/Hebrew
- **Call translation strip** — active language selector (EN/ES/AR/ZH/TL/FR), translation confidence
- **CAD-ready panel** (right rail) — pre-populated nature code, location, notes. PENDING badge until dispatcher submits. SUBMIT TO CAD button. Manual mode toggle. FLAG button.

**Left sidebar (in session):**
- Unit status board — all units with AVAILABLE / EN ROUTE / ON SCENE / BUSY / OFF DUTY badges, beat assignment, time on status
- My Queue — open incidents assigned to this dispatcher

**Action buttons (bottom):**
- Mark Reviewed
- Escalate to Supervisor
- Copy Summary
- Add Operator Note

**Intelligence panel (right, below CAD):**
- AI SUGGESTED badge
- AI-recommended incident type with confidence
- Protocol suggestions (if SOP enabled)
- Caller history (if returning caller)

### Permissions
- Access live call workspace
- Create, update, close, reassign, escalate incidents
- Submit to CAD (requires supervisor approval per config)
- View CAD writeback queue (own calls)
- Live transcription and translation
- Request caller media (text link, video assist)
- Live video (KVS WebRTC)
- View and acknowledge coaching notes (own)
- Join war rooms (view only)
- View incident timeline
- View reports (own)

### Cannot
- Silent monitor other dispatchers
- Approve CAD writeback
- View other dispatchers' coaching notes
- Create scorecards
- Access admin, settings, integrations
- View billing or agency management

---

## supervisor — Communications Supervisor

**Real-world identity:** The shift supervisor watching over dispatchers in real time. Monitors active calls, approves CAD writebacks, reviews quality, manages escalations, and serves as the command authority during major incidents.

**Dashboard URL:** `/{jurisdiction}/supervisor`

**Visual theme:** Same dark theme as dispatcher but with a supervisor command rail visible. "SUPERVISOR" role badge. Active calls panel shows ALL dispatchers, not just one.

### Navigation sidebar
- Supervisor Dashboard (home — ops command view)
- Active Calls (all dispatchers, real-time)
- Incidents (full queue, all units)
- QA / Coaching (scorecards, coaching notes)
- Team Performance (dispatcher stats, SLA)
- Reports (generate, schedule, export)
- CAD Writeback Queue (approve/reject)
- History
- Media (monitor, not request)
- Audit Log (own agency)

### Home dashboard widgets
1. **SLA bar** — current shift answer time, abandonment rate, average handle time vs configured thresholds
2. **Active calls grid** — all dispatchers with current call status, incident type, duration, flag indicators. Click any row to silently monitor.
3. **CAD writeback queue** — pending approvals from dispatchers. Approve / Reject actions with required reason.
4. **Incident queue** — all open incidents by priority, with escalation flags highlighted
5. **Team workload stats** — active calls per dispatcher, queue depth, idle time
6. **Escalated incidents** — any incidents flagged for supervisor review
7. **Flags and alerts** — welfare checks, active complaints, legal holds

### Permissions
- All dispatcher permissions
- Silent monitor any active call (logged — dispatcher sees "SUPERVISOR WATCHING")
- Supervisor assist (join active call session with audit trail)
- Approve or reject CAD writeback submissions
- Create and submit scorecards
- Create coaching notes for dispatchers
- View all dispatcher coaching notes and scorecards
- Create war rooms (major incident command)
- Create stakeholder status pages
- Create post-incident reviews
- Configure SLA thresholds
- Delete analysis (own agency)
- View audit log (own agency)
- Schedule reports, view SLA trends

### Cannot
- Access system settings or agency configuration
- Create or deactivate users
- Manage integrations
- View billing
- Access RC Admin area

---

## agencyadmin — Agency Administrator

**Real-world identity:** The agency's system administrator or communications center director. Manages users, configures the system, handles compliance settings, manages integrations, and reviews operational reports.

**Dashboard URL:** `/{jurisdiction}/admin`

**Visual theme:** Admin-toned dark theme. Blue-grey accents. "ADMIN" badge. **No live call workspace visible — this is a management console.**

### Navigation sidebar
- Admin Overview (home)
- Users (manage all agency users)
- Roles & Permissions
- Integrations (CAD, Ring, webhooks, API keys)
- Compliance (retention, CJIS settings)
- Reports (all, schedule, export)
- Billing (own agency — view subscription, invoices, payment methods)
- Audit Log (own agency — view and export)
- System Settings (own agency)
- History
- Notifications

### Home dashboard widgets
1. **Quick stats** — total active users, dispatchers online now, incidents this week, SLA score this month
2. **Quick links** — Add User, View Reports, Check Integrations, Download Audit Log
3. **Recent activity** — user logins, setting changes, integration events (last 24h)
4. **Reports summary** — last generated report + quick generate
5. **Integration health** — CAD adapter status, Ring status, webhook delivery rate
6. **Compliance status** — data retention policy, MFA enforcement rate, expiring certs

### Permissions
- Create, update, deactivate agency users
- Manage roles and permissions for own agency
- Provision dispatcher accounts
- View all incidents (cannot create/update/close — operational separation)
- View and export audit log (own agency)
- View and export analysis
- Manage integrations (view, manage, test, API keys, webhooks)
- Manage CAD writeback config
- View CAD writeback audit log
- Manage compliance settings (retention, CJIS)
- Configure SLA thresholds
- Manage MFA policy for own agency
- View and manage agency billing (subscription, invoices, payment methods)
- Create and manage war rooms
- Create post-incident reviews
- Delete incidents and analysis (own agency)
- Full reports access (view, create, export, schedule)

### Cannot
- **Access live call workspace (operational separation — redirect if landed on dispatcher URL)**
- Approve CAD writeback (that's supervisor's job)
- Access RC Admin or any cross-tenant data
- Modify platform feature flags

---

## agencyit — Agency IT Administrator

**Real-world identity:** The agency's technical IT staff. Focuses on integrations, CAD configuration, API keys, system settings, and technical user management. Shares some admin permissions but not the compliance/operational authority of agencyadmin.

**Dashboard URL:** `/{jurisdiction}/admin/it`

**Visual theme:** Same admin theme. "IT ADMIN" badge. Navigation scoped to technical functions — no billing, no compliance (except MFA).

### Navigation sidebar
- IT Overview (home)
- Integrations (CAD, Ring, webhooks, API keys)
- Users (view, create, update, deactivate — no role management)
- System Settings (view and edit)
- CAD Administration
- Audit Log (view — own agency)
- Security (MFA policy)
- Reports (view and schedule — operational data)

### Home dashboard widgets
1. **Integration health** — all connected services with last-sync timestamp, error rates
2. **CAD adapter status** — connection state, last poll, pending writebacks, error log
3. **User activity** — login activity and failed auth events (last 24h)
4. **API key status** — active keys, last used, expiry warnings
5. **Webhook delivery** — success rate, recent failures

### Permissions
- Same as agencyadmin except:
  - Cannot manage compliance settings or data retention
  - Cannot manage billing
  - Cannot manage roles (can create/update/deactivate users)
  - Cannot export audit log
  - Cannot delete incidents or analysis

### Cannot
- Access live call workspace
- Approve CAD writeback
- Manage billing
- Manage data retention / CJIS compliance config
- Create scorecards or coaching notes

---

## analyst — QA Analyst / Quality Reviewer

**Real-world identity:** The quality assurance reviewer. Listens to recordings, scores calls, reviews transcripts, and provides written analysis. Not operational — never touches live calls.

**Dashboard URL:** `/{jurisdiction}/analytics`

**Visual theme:** Muted dark theme, teal/slate accents. "QA ANALYST" badge. No live ops panels anywhere.

### Navigation sidebar
- QA Dashboard (home)
- Review Queue (sessions pending scoring)
- Scorecards (view, create)
- Transcripts (view, download)
- Reports (QA-specific: trends, scores, quality metrics)
- History (completed sessions)

### Home dashboard widgets
1. **Review queue** — calls pending QA review, oldest first, with incident type and flagged categories
2. **Scorecard stats** — submissions this week, average score across agency, trend
3. **My activity** — scorecards submitted, reports generated this month
4. **Quality trend chart** — rolling 30-day average score by dispatcher (anonymized on home unless drilling down)
5. **Flagged calls** — any calls auto-flagged by AI for quality review

### Permissions
- View all incidents (own agency)
- View all transcripts (download)
- View all analysis (export)
- Create and submit scorecards
- View call quality trends
- Create coaching notes (cannot create post-incident reviews)
- View post-incident reviews
- View incident timeline
- Create and export reports
- View audit log (own agency — no export)

### Cannot
- Modify any incident
- Approve or reject CAD writeback
- Access live call workspace
- Create users or manage roles
- Manage integrations or system settings
- Access billing

---

## auditor — Executive Auditor / Compliance Viewer

**Real-world identity:** The executive director, compliance officer, city attorney, or oversight body. Read-only across all reports and audit records. Never touches operational data directly.

**Dashboard URL:** `/{jurisdiction}/audit`

**Visual theme:** Clean, professional dark theme. Silver/slate accents. "AUDITOR" badge. No action buttons anywhere on the dashboard — everything is view and export only.

### Navigation sidebar
- Audit Overview (home)
- Audit Log (full history, filter, export)
- CAD Writeback Audit
- Access Reports (who accessed what, when)
- Reports (operational reports — view and export)
- History (incident history, read-only)
- Post-Incident Reviews (view only)

### Home dashboard widgets
1. **Trends overview** — call volume trend, SLA summary, incident closure rate (30/60/90 day)
2. **Audit activity** — recent audit log entries (filtered to significant events)
3. **Access reports** — recent access activity summary
4. **CAD writeback log** — recent writeback events with approval chain
5. **Reports** — quick link to download last generated compliance report

### Permissions
- View incidents (all, own agency)
- View transcripts (download)
- View all analysis (export)
- View audit log (export)
- View CAD writeback audit
- View access reports
- View post-incident reviews
- View incident timeline
- View reports (export only — cannot create or schedule)
- View users (no modification)

### Cannot
- Modify anything — this role has no write access at all
- Create scorecards, coaching notes, or reports
- Approve CAD writeback
- Access live workspace
- Manage users, settings, or integrations

---

# SECTION 3 — CAMPUS ROLES

Campus is a product vertical — not a PSAP. Campus users never see the dispatcher workspace, CAD tools, or transcription panels. Their console is purpose-built for campus safety reporting, QR-triggered incident management, and building awareness.

**Header requirement:** Subtext must include **"NOT A 911 DISPATCH CONSOLE"** on every campus page.

---

## CAMPUS_ADMIN — Campus Safety Administrator

**Real-world identity:** Director of campus public safety, emergency management coordinator, or IT lead at a university or school. Manages scan points, configures alerts, reviews reports, and manages campus users.

**Dashboard URL:** `/app/campus/{code}`

**Visual theme:** Dark slate/charcoal background, slate-blue (`slate-600`) accents, "Campus Safety" header with campus code badge. Clear label "NOT A 911 DISPATCH CONSOLE" in the header subtext. No PSAP or CAD elements visible.

### Navigation sidebar
- Campus Dashboard (home)
- Incidents (campus-reported incidents)
- QR Codes (scan point management — admin only)
- Zones (campus zone map and building management)
- Reports (campus analytics, incident trends)
- Users (manage campus-role users)
- Settings (campus configuration)

### Home dashboard widgets
1. **Active incidents** — open campus incidents by type and zone, with recency
2. **QR scan activity** — scans today, most active scan point, recent submissions
3. **Zone map** — visual campus map with zone-level incident heat
4. **Reports** — monthly incident summary, top building, top type
5. **User activity** — staff logins, pending user invitations

### Key interactions
- Create and download QR codes for buildings and scan points (PDF/PNG bulk export)
- Bulk import QR scan point list
- Deactivate outdated scan points
- Assign incidents to campus security staff
- View full incident detail and notes thread

---

## CAMPUS_SUPERVISOR — Campus Safety Supervisor

**Real-world identity:** Shift supervisor for campus security or associate director of campus safety.

**Dashboard URL:** `/app/campus/{code}`

**Visual theme:** Same as CAMPUS_ADMIN but "SUPERVISOR" badge. QR management section is read-only (no create/edit).

### Navigation (vs Admin)
- No QR code create/edit
- No User management
- No Settings

### Home dashboard widgets
- Same as CAMPUS_ADMIN minus admin-specific cards
- Focus on active incidents and zone status

### Permissions vs CAMPUS_ADMIN
- Can view and download QR codes (cannot create or deactivate)
- Cannot manage users or settings
- Can manage incidents (update, escalate, close)

---

## CAMPUS_SECURITY — Campus Security Officer

**Real-world identity:** Front-line campus security officer. Responds to QR-triggered reports, updates incident status, submits notes.

**Dashboard URL:** `/app/campus/{code}`

**Visual theme:** Same slate campus theme. "SECURITY" badge. Simplified navigation — no admin tools visible.

### Navigation
- Campus Dashboard
- Incidents (assigned to me + open)
- QR Codes (view/download only)
- Zones (view only)

### Home dashboard widgets
1. **My assigned incidents** — currently open, assigned to this officer
2. **Recent submissions** — QR-triggered reports in last hour
3. **Zone status** — quick view of campus zones with incident flags

### Permissions
- View and download QR codes (cannot create)
- View incidents (all campus)
- Update incidents (notes, status changes)
- Escalate incidents
- Cannot manage users, settings, or QR admin

---

## CAMPUS_DISPATCH — Campus Dispatch

**Real-world identity:** An internal campus dispatcher who coordinates response — not a PSAP dispatcher, does not handle 911 calls, does not have CAD access. Routes campus security officers to QR-triggered incidents.

**Dashboard URL:** `/app/campus/{code}`

**Visual theme:** Same campus theme, "DISPATCH" badge. Has an active incident queue similar to supervisor but scoped to campus incidents only. No PSAP workspace elements.

### Navigation
- Campus Dashboard
- Incidents (full queue, create, assign)
- Zones
- Reports (view)

### Home dashboard widgets
1. **Active incident queue** — all open campus incidents with priority and assigned officer
2. **Unassigned incidents** — new submissions needing officer assignment
3. **Zone status** — real-time zone activity

### Permissions
- Create, update, assign, close campus incidents
- View all campus zones and buildings
- Escalate to external emergency services (generates alert, does not interface with PSAP CAD)
- Cannot manage QR codes or users

---

# SECTION 4 — HOSPITAL ROLES

The hospital vertical is a capacity and routing portal. Hospital users never see dispatch workspaces, campus reports, or venue operations. Their interface is focused on bed capacity, diversion status, and facility routing.

---

## HOSPITAL_ADMIN — Hospital Facility Administrator

**Real-world identity:** Hospital emergency department director, EMS liaison, or hospital command center lead. Configures routing settings, manages users, reviews capacity trends, and coordinates with regional EMS.

**Dashboard URL:** `/hospital-admin/dashboard`

**Visual theme:** Dark theme with teal (`teal-600`) accents. "HOSPITAL ADMIN" badge. Clean clinical aesthetic — high information density, no decorative elements.

### Navigation sidebar
- Facility Dashboard (home)
- Capacity Management (real-time and scheduled)
- Routing Configuration (diversion thresholds, EMS routing rules)
- Regional Map (all facilities in region, capacity overview)
- Analytics (capacity trends, diversion history, EMS volume)
- Users (manage hospital-role users)
- Settings (facility configuration)

### Home dashboard widgets
1. **Current capacity status** — ED beds available, trauma capacity, diversion status (OPEN / ALERT / DIVERSION) in large, clear format
2. **Facility comparison** — capacity across all hospitals in region (regional map)
3. **Capacity trend** — 7-day rolling bed availability chart
4. **Recent routing events** — last 10 EMS routing decisions into this facility
5. **Staff activity** — who updated capacity last, time of last update
6. **Analytics summary** — this week vs last week volume, average diversion duration

---

## HOSPITAL_STAFF — Clinical Staff / Charge Nurse

**Real-world identity:** ED charge nurse or department coordinator. Updates real-time bed capacity as patients arrive and are discharged.

**Dashboard URL:** `/hospital-staff/dashboard`

**Visual theme:** Same teal hospital theme. "STAFF" badge. Simplified interface — capacity update is the primary and nearly only action.

### Navigation
- Capacity Update (home — primary action)
- History (my recent submissions)

### Home dashboard
1. **Current status** — large current capacity display (beds available, diversion status)
2. **Quick update form** — increment/decrement bed count with confirmation, reason selection (elective, trauma, hold), optional note
3. **Recent updates** — last 5 submissions with timestamps and who submitted

### Permissions
- Update bed capacity for own facility
- View own facility capacity history
- Cannot see other facilities
- Cannot configure routing rules or manage users

---

## HOSPITAL_COORDINATOR — EMS/Hospital Coordinator

**Real-world identity:** Regional EMS coordinator, hospital liaison, or dispatch center hospital desk. Bridges between hospital capacity and EMS routing decisions. Has more visibility than staff but less administrative authority than admin.

**Dashboard URL:** `/hospital-admin/dashboard` (same shell as admin, scoped view)

**Visual theme:** Same hospital theme. "COORDINATOR" badge.

### Navigation
- Facility Dashboard
- Capacity Management (view + update)
- Regional Map (view)
- Analytics (view)
- Routing Configuration (view only — cannot modify)

### Permissions vs HOSPITAL_ADMIN
- Cannot manage users
- Cannot modify routing configuration (view only)
- Can view all facility capacity (regional map)
- Can update capacity for assigned facilities
- Can view analytics but cannot export

> **Note:** Permission set for `HOSPITAL_COORDINATOR` is not yet fully defined in `packages/security` — treat this section as product intent until matrix is updated.

---

# SECTION 5 — VENUE ROLES

Venue is a product vertical for sports venues, arenas, stadiums, and event centers. The aesthetic is bold and action-oriented with orange branding. Venue users never see PSAP dispatch, campus safety, or hospital portals.

---

## VENUE_ADMIN — Venue Operations Administrator

**Real-world identity:** VP of Operations, Director of Guest Services, or Security Director at a sports venue, arena, or large event center. Manages the full venue operations platform.

**Dashboard URL:** `/app/venue/{code}` (also `/venue/{code}`)

**Visual theme:** Dark background, **orange (`orange-500`)** accents throughout. Bold, large-format headers. "VENUE ADMIN" badge. Event/game name visible in header when event is active ("Game Day Operations Console"). Designed for a control room with multiple monitors.

### Navigation sidebar
- Dashboard (home — full ops view)
- Incidents (all venue incidents)
- Guest Reports (public-submitted reports)
- Staff (staff roster, status)
- Cameras (Ring + facility cameras)
- QR Codes (scan point management — admin only)
- Zones (venue zones, sections)
- Analytics (incident trends, staff performance)
- Reports
- Settings (venue configuration)

### Home dashboard widgets
1. **Live stats row** — Active incidents, Open guest reports, Staff on duty, Cameras online (4 large stat cards)
2. **Active incidents table** — all open incidents with zone, type, assigned staff, duration
3. **Guest reports feed** — live incoming guest reports (text + location) with ASSIGN and RESOLVE actions
4. **Staff status board** — all on-duty staff with current assignment and zone
5. **Camera grid** — live thumbnails from Ring + facility cameras, click to expand
6. **QR scan activity** — scan events in last hour, most active zones
7. **Incident heatmap** — venue map with incident density by section

### Key interactions
- Create and bulk-download QR codes for venue zones/entrances
- Assign guest reports to staff
- Pull up any Ring or facility camera instantly from incident context
- Initiate text communication with caller from incident panel

---

## VENUE_SUPERVISOR — Venue Operations Supervisor

**Real-world identity:** Operations shift supervisor, security shift lead, or event day manager.

**Dashboard URL:** `/venue/{code}`

**Visual theme:** Same orange venue theme. "SUPERVISOR" badge. Same full ops view as admin.

### Navigation (vs Admin)
- All nav items EXCEPT QR code creation/management and Settings
- QR Codes tab visible in read-only mode (view, download — no create/deactivate)

### Home dashboard
- Identical to VENUE_ADMIN home

### Permissions vs VENUE_ADMIN
- No QR code creation or deactivation
- No user management
- No venue settings changes
- All operational capabilities (incidents, guest reports, cameras, staff management)

---

## VENUE_SECURITY — Security Staff

**Real-world identity:** Security officer working the event. Responds to incidents, views cameras in their zone, sees guest reports relevant to their assignment.

**Dashboard URL:** `/venue/{code}`

**Visual theme:** Orange venue theme. "SECURITY" badge. Focused interface — no analytics, no settings.

### Navigation
- Dashboard (home)
- Incidents (all, can update)
- Guest Reports (view + respond)
- Staff (view roster)
- Cameras (view)
- Zones (view)

### Home dashboard widgets
1. **My zone** — active incidents and guest reports in assigned zone
2. **All open incidents** — venue-wide active incidents
3. **Guest reports** — recent unresolved reports
4. **Cameras** — camera access for assigned zone

### Permissions
- View all incidents (full venue)
- Create, update, close incidents
- View and respond to guest reports
- View cameras
- Cannot access analytics, QR codes, or settings
- Cannot manage staff or users

---

## VENUE_OPERATOR — Event Day Operator

**Real-world identity:** Event day floor staff (usher lead, operations runner) who needs basic situational awareness and incident queue access. Not a security role — more logistics.

**Dashboard URL:** `/venue/{code}`

**Visual theme:** Same orange theme. "OPERATOR" badge. Minimal navigation — only what's needed.

### Navigation
- Dashboard (home)
- Incidents
- QR Codes (when granted `locations.qrcodes.manage` — product may extend beyond this spec)

### Home dashboard widgets
1. **Incident queue** — open incidents, simplified view (no staff board, no cameras, no guest reports by default)
2. **Zone status** — simple list of zones with incident count

### Permissions
- View incidents (cannot create by default)
- View zone status
- Cannot access guest reports, cameras, staff board, analytics, or settings (unless explicitly granted)

---

## VENUE_GUEST_SERVICES — Guest Services Staff

**Real-world identity:** Box office staff, customer service, fan experience team. Receives and routes public guest reports but has no security authority.

**Dashboard URL:** `/venue/{code}`

**Visual theme:** Same orange theme. "GUEST SERVICES" badge. **Must display "NOT A 911 EMERGENCY DISPATCH SYSTEM" on every page** — persistent banner or header subtext, not dismissible.

### Navigation
- Guest Reports (home — ONLY section)

### Home dashboard
1. **Incoming guest reports** — real-time feed of public submissions
2. **My handled reports** — reports I've responded to or routed
3. **Quick actions** — Route to Security, Mark Resolved, Add Note

### Permissions
- View and respond to guest reports only
- Cannot see incident queue
- Cannot view cameras, staff board, or any operational data
- Cannot create incidents or manage anything

### Design note
This role is the most restricted. The UI should feel like a customer service inbox, not a security console. Orange accents are present but the layout is deliberately calm and non-tactical.

---

# DESIGN PRINCIPLES ACROSS ALL ROLES

## Shared visual rules
- **Font options** — Courier, Inter, Times New Roman, Arial available for accessibility (dispatcher workspace only)
- **Status colors** — consistent across all verticals:
  - Green = available / nominal / open
  - Yellow/amber = en route / warning / pending review
  - Orange = on scene / alert / escalated (venue brand color when in venue context)
  - Red = busy / critical / ALARM
  - Blue (sky) = PSAP/dispatch actions
  - Orange = Venue actions
  - Slate = Campus actions
  - Teal = Hospital actions
  - Violet = RC Admin actions
- **Role badge** — always visible in the top-right header, adjacent to username. Makes it immediately clear what role is signed in.
- **Agency/vertical context** — always visible in the header. Dispatchers see agency name + PROD/DEV badge. Venue users see venue name + event name. Campus users see campus code.
- **No action buttons the role can't use** — if a button would return 403 for this role, it must not appear at all. Grayed-out buttons are acceptable only when the action is temporarily unavailable (e.g., no incident selected), never for permanent permission restrictions.
- **Emergency clarity** — anything that could be confused with 911 dispatch must carry an explicit disclaimer for non-PSAP roles (campus, venue guest services, hospital).

## Multi-monitor layout targets
- Dispatcher, supervisor, and venue admin/supervisor dashboards are designed for two or three monitors
- Primary monitor: live workspace / incident queue
- Secondary monitor: unit status board / team overview / camera grid
- Third monitor (if available): maps, analytics, admin tools

## Mobile responsiveness
- RC Admin, agencyadmin, analyst, auditor: responsive — these users often review from laptops or tablets
- Dispatcher and supervisor: desktop-first — command center environment, not mobile
- Venue guest services, campus security: tablet-compatible — staff may be on floor with iPads
- Hospital staff: tablet-optimized — capacity update from bedside device

---

## Active roles index (21)

| # | Role | Section |
|---|------|---------|
| 1 | rcsuperadmin | RC Internal |
| 2 | rcadmin | RC Internal |
| 3 | rcitadmin | RC Internal |
| 4 | dispatcher | PSAP |
| 5 | supervisor | PSAP |
| 6 | agencyadmin | PSAP |
| 7 | agencyit | PSAP |
| 8 | analyst | PSAP |
| 9 | auditor | PSAP |
| 10 | CAMPUS_ADMIN | Campus |
| 11 | CAMPUS_SUPERVISOR | Campus |
| 12 | CAMPUS_SECURITY | Campus |
| 13 | CAMPUS_DISPATCH | Campus |
| 14 | HOSPITAL_ADMIN | Hospital |
| 15 | HOSPITAL_STAFF | Hospital |
| 16 | HOSPITAL_COORDINATOR | Hospital |
| 17 | VENUE_ADMIN | Venue |
| 18 | VENUE_SUPERVISOR | Venue |
| 19 | VENUE_SECURITY | Venue |
| 20 | VENUE_OPERATOR | Venue |
| 21 | VENUE_GUEST_SERVICES | Venue |

**Deprecated (removed from Cognito):** `commsupervisor`, `CAMPUS_COUNSELOR`, `CAMPUS_FACULTY`, `TRANSIT_*`

---

# AUTHORIZATION LAYER — QR LOCATIONS

RC internal roles manage QR codes cross-tenant via `packages/security/src/qr-locations-access.ts` and `locations.qrcodes.manage` / `locations.qrcodes.view` in the Role Access Matrix v2.

| Permission | rcsuperadmin | rcadmin | rcitadmin | CAMPUS_ADMIN | VENUE_ADMIN |
|---|---|---|---|---|---|
| `locations.qrcodes.manage` | **o** (immutable) | Y | Y | Y | Y |

**RC Admin UI:** `/rc-admin/location-qr-codes` — agency picker (venue/campus tenants only) scopes all API calls. Empty state: "Select an agency" until a tenant is chosen.

**Implementation files:**
- `packages/security/src/qr-locations-access.ts` — `rcInternalMayManageQr()` cross-tenant bypass
- `apps/web/components/rc-admin/rc-admin-qr-panel.tsx` — agency picker + `LocationsQrAdminPanel`
- `apps/web/lib/locations/qr-access.ts` — nav + client-side permission helpers
