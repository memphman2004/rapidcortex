# NexCort iQ K–12 — Platform Capability Audit

**Audit date:** November 2026  
**Auditor:** Cursor implementation agent  
**Purpose:** Map existing repository capabilities against the K–12 platform requirements before implementing missing features. Preserves working functionality; identifies gaps for Phase 2 build.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ **Implemented and verified** | Code found, routes registered in SAM, frontend page exists |
| ⚠️ **Implemented but incomplete** | Scaffolding or partial implementation; known gaps noted |
| 🔄 **Existing and reusable** | General platform capability usable by K-12 without modification |
| ❌ **Missing** | No implementation found; must be built |
| 🚫 **Blocked / higher-ed only** | Intentionally disabled or gated to a different institution type |
| 🔒 **Requires licensing / legal review** | External service, agency DPA, or legal review required before shipping |

---

## 1. Role System

| Feature | Status | Notes |
|---------|--------|-------|
| `campus_admin_k12` role | ✅ | `packages/shared/src/auth/rapid-cortex-roles.ts` |
| `campus_supervisor_k12` role | ✅ | Defined and in `CAMPUS_ASSIGNABLE_ROLES` |
| `campus_security_k12` role | ✅ | Defined |
| `campus_dispatch_k12` role | ✅ | Defined |
| `campus_counselor_k12` role | ✅ | Defined; counselor queue filter implemented in incident service |
| `campus_faculty_k12` role | ✅ | Defined; nav restricted to Pickup Authorization only |
| K-12 vs higher-ed role separation | ✅ | `parseCampusInstitutionType()` in `institution-type.ts`; legacy unsuffixed tokens → K-12 |
| Unsuffixed `CAMPUS_*` → K-12 alias | ✅ | `rapid-cortex-roles.ts` comment confirms alias behavior |
| K-12 role routing | ✅ | `/app/campus/{code}` for all campus roles |
| District-level admin role | ❌ | No `campus_district_admin` role for multi-site district management |
| Principal role | ❌ | No `campus_principal` role (school-level admin below district) |
| School nurse role | ❌ | No `campus_nurse` role for health office workflows |
| Transportation coordinator role | ❌ | No `campus_transportation` role for bus/routing workflows |
| Threat assessment team member role | ❌ | No `campus_threat_assessment` role for BTAM case workers |

---

## 2. Visitor Management

| Feature | Status | Notes |
|---------|--------|-------|
| Visitor check-in form | ✅ | `visitor-verification-client.tsx`; name, ID type, purpose, visiting staff, vehicle plate, phone |
| NSOPW sex offender screening | ✅ | `searchNsopw()` from `packages/shared/src/campus/nsopw-client.ts`; called in `handleVisitorCheckIn()` |
| Clearance status display | ✅ | `cleared` / `flagged` / `review_required` with color coding |
| Visitor log (GET /visitors) | ✅ | Paginated visitor list with agencyId scope |
| DynamoDB visitor table | ✅ | `CAMPUS_VISITORS_TABLE`; `AGENCY#/VISIT#{dateKey}#{visitorId}` key pattern |
| ID photo capture / upload | ⚠️ | `idPhotoKey` field in schema; upload URL endpoint exists; browser camera capture not implemented in UI |
| Digital badge printing | ❌ | No badge generation (PDF/ZPL) or print queue |
| Volunteer management | ❌ | No volunteer registry; no background check status tracking; no clearance expiry |
| Contractor management | ❌ | No contractor registry separate from visitor check-in |
| Returning visitor fast lane | ❌ | No "recognized visitor" shortcut; each visit triggers full NSOPW re-check |
| Custodial restriction flag on visitor | ❌ | No link between visitor profile and custody restriction records; custody check is manual |
| Visitor notification to staff | ❌ | No "you have a visitor" push/SMS notification to `visitingStaff` member |
| Visitor sign-out workflow | ❌ | No sign-out timestamp or active-visitor tracking |
| Multi-day pass / scheduled visit | ❌ | No pre-scheduled or recurring visitor passes |
| Watch list (agency-defined) | ❌ | Only NSOPW national registry; no per-agency custom watch list |
| Visitor analytics dashboard | ⚠️ | Campus analytics Lambda exists; no visitor-specific widget in UI |
| ADA/accessibility mode for kiosk | ❌ | No self-service kiosk UI mode |

---

## 3. Student Pickup Authorization

| Feature | Status | Notes |
|---------|--------|-------|
| Authorized pickup records | ✅ | `campus-pickup-service.ts`; `authorizedPickupSchema` with name, relationship, phone, photoKey, notes |
| Student pickup record (GET/PUT) | ✅ | `GET/PUT /api/campus/{agencyId}/pickup-auth` |
| Restricted person list | ✅ | `restrictedPersonIds[]` on `studentPickupRecordSchema` |
| Pickup auth UI | ✅ | `pickup-auth/page.tsx`; role-based access; CAMPUS_FACULTY sees only this nav item |
| Photo upload for authorized persons | ⚠️ | `photoKey` field exists; actual S3 upload flow not confirmed in UI |
| Court order / legal document upload | ❌ | No document attachment to custody restrictions |
| Custody change notification to staff | ❌ | No alert when a restricted person attempts pickup |
| Late pickup / dismissal tracking | ❌ | No dismissal workflow or end-of-day pickup log |
| Guardian match at pickup | ❌ | No ID-scan-to-record match for in-person pickup verification |
| Student lookup (search by name/ID) | ❌ | No student directory; pickup records must be found by known student ID |
| Bulk import from SIS | ❌ | No SIS integration for student/guardian roster sync |

---

## 4. Incident Reporting

| Feature | Status | Notes |
|---------|--------|-------|
| K-12 incident type catalog | ✅ | 50+ types in `incident-types.ts`; groups in `k12-intake.ts` |
| K-12 incident group taxonomy | ✅ | `K12_INCIDENT_GROUP_IDS`: emergency_threats, student_safety_wellness, bullying_misconduct, drugs_prohibited, medical_health, security_suspicious, transport_facilities, other_concerns |
| Follow-up intake questions per type | ✅ | `K12_FOLLOW_UP_BY_TYPE` with per-type question trees (weapon, bullying, self_harm, custody_pickup, etc.) |
| Anonymous public report (QR scan) | ✅ | `POST /api/public/campus/report`; rate-limited (5/IP/hour); no auth required |
| SMS incident intake | ✅ | `campus-sms-intake-service.ts`; cold inbound → new incident; chat-thread continuation |
| Manual incident creation (staff) | ✅ | `POST /api/campus/incidents` |
| NFC/QR location context on incident | ✅ | `qr-nfc-incident-service.ts`; building/floor/zone from QR scan |
| Incident status lifecycle | ✅ | `open → assigned → responding → resolved → referred → escalated` |
| Incident notes | ✅ | `POST /api/campus/incidents/{id}/notes` |
| Incident escalation | ✅ | `POST /api/campus/incidents/{id}/escalate` |
| Incident media attachment | ✅ | `/api/public/incident-media/t/{token}/upload-url` + confirm |
| After-action PDF export | ✅ | `campus-after-action-pdf.ts` generates LETTER PDF with EAP checklist |
| Incident list / queue | ✅ | `GET /api/campus/incidents`; counselor queue filter |
| Incident list UI | ✅ | `incidents/page.tsx` |
| Incident type aliases (backward compat) | ✅ | `K12_INCIDENT_TYPE_ALIASES` normalizes legacy codes |
| Anonymous tip management UI | ⚠️ | Public intake works; no "tip inbox" UI for reviewing/acting on anonymous tips |
| Auto-notify counselor on mental_health | ⚠️ | Assignment to `campus_counselor` happens in service; push notification to counselor not confirmed |
| Parent/guardian incident notification | ❌ | No automated parent notification on critical incidents |
| Incident linking / related cases | ❌ | No "related incidents" or series tracking across events |
| Re-open closed incident | ❌ | No re-open workflow from resolved status |

---

## 5. Emergency Operations

| Feature | Status | Notes |
|---------|--------|-------|
| Silent panic activation | ✅ | `SilentPanicPanel.tsx`, `silent-panic.ts`, `silentPanicActivationSchema`; school/building/site selection |
| Threat level management | ✅ | `GET/PATCH /api/campus/{agencyId}/threat-level`; `PatchCampusThreatLevelFunction` |
| District schools panel (multi-school) | ✅ | `DistrictSchoolsPanel.tsx`; grade level badges, alert status dots, active incident counts |
| Broadcast notifications | ✅ | `POST /api/campus/{agencyId}/broadcast`; `PostCampusBroadcastFunction` |
| Emergency Action Plans (EAP) | ✅ | `campus-eap-service.ts`; per-building/per-incident-type step lists |
| EAP checklist on incident | ✅ | `eap-schemas.ts`; matched in `GET /api/campus/eap/match` |
| War rooms (collaborative command) | ✅ | `war-rooms/page.tsx` + `CampusWarRoomsClient`; feature-flagged (`isWarRoomsEnabled()`) |
| Security event webhook ingestion | ✅ | `POST /api/public/campus/{campusCode}/security-events`; VMS/ALPR/alarm/sensor sources |
| Campus alerts mass SMS | 🚫 | `CAMPUS_ALERTS_ARCHITECTURE.md`: explicitly higher-ed only; K-12 uses broadcast + silent panic |
| Lockdown drill scheduling | ❌ | No drill scheduling, compliance tracking, or ALICE/CISA drill type management |
| Reunification management | ❌ | No student/guardian reunification workflow; no accountability roster |
| Evacuation roll call / accountability | ❌ | No digital roll call or headcount during evacuation |
| Multi-school district lockdown | ⚠️ | Threat level affects one campus; no district-wide simultaneous lockdown push |
| 911 escalation workflow | ⚠️ | Escalation API exists; no built-in CAD submission from campus (not a PSAP) |
| Interoperability with PSAP dispatch | 🔄 | EventBridge `incident.created` from CAD account; campus-to-PSAP is explicit call-911 instruction |

---

## 6. Counselor & Wellness

| Feature | Status | Notes |
|---------|--------|-------|
| Counselor role (RBAC) | ✅ | `campus_counselor_k12`; sees only `mental_health` and `wellness_check` queue |
| Counselor queue filter | ✅ | `GET /api/campus/incidents?queue=counselor`; also auto-applies when role lacks `canViewIncidents` |
| Counselor queue type definitions | ✅ | `counselor-queue.ts`: `["mental_health", "wellness_check"]` |
| Counselor queue API | ✅ | Implemented inside `get-campus-incidents.ts` |
| Counselor queue UI | ⚠️ | `counselor/page.tsx` exists; contents not fully verified against service |
| Behavioral threat assessment (BTAM) | ❌ | No CISA/NTAC TAF case management, threat level scoring, multi-party case review |
| Crisis intervention checklists | ❌ | EAP covers building-level emergency steps; no student-level crisis protocol checklist |
| Mandatory reporter workflow | ❌ | No guided mandatory reporter checklist for abuse/neglect/trafficking incidents |
| Safe-to-return certification | ❌ | No workflow for documenting safe-to-return decisions after mental health incidents |
| External referral tracking | ❌ | No tracking of referrals to outside agencies (DCFS, hospital, law enforcement) |

---

## 7. Campus Intelligence & Awareness

| Feature | Status | Notes |
|---------|--------|-------|
| Camera registry | ✅ | `CampusCameraRegistryListCreateFunction`; fixed camera registry with KVS channels |
| Camera viewer token | ✅ | `GET /api/campus/{agencyId}/cameras/viewer-token`; KVS WebRTC viewer |
| PTZ camera control | ✅ | `POST /api/campus/{agencyId}/cameras/{cameraId}/ptz` |
| Camera heartbeat | ✅ | `CampusCameraAgentHeartbeatFunction` |
| Bluelight pole registry | ✅ | `GET /api/campus/bluelight/poles`; `BlueLightGetPolesFunction` |
| Bluelight activation | ✅ | `POST /api/campus/bluelight/activate` |
| Video wall | ✅ | `VideoWallHttpFunction`; per-user layout config (`VideoWallConfigsTable`) |
| Vision AI scene intelligence | ✅ | `vision-ai/page.tsx`; `Rapid Vision` feature-gated |
| RC Translate on campus | ✅ | `translate/page.tsx` |
| Staff on-duty | ✅ | `GET /api/campus/{agencyId}/staff/on-duty` |
| Security event integration (VMS/ALPR) | ✅ | `campusSecurityEventBodySchema`; maps to incident types |
| Automation rules | ✅ | `GET/POST /api/campus/automation-rules`; `automation-rule-schemas.ts` |
| ALPR-to-incident auto-creation | ⚠️ | Security event handler maps ALPR → incident type; no dedicated ALPR plate-to-student lookup |
| Situational awareness dashboard | ⚠️ | Dashboard stats endpoint exists; no dedicated map/heat-map view for K-12 |

---

## 8. Reporting & Compliance

| Feature | Status | Notes |
|---------|--------|-------|
| Campus analytics | ✅ | `GetCampusAnalyticsFunction`; `analytics/page.tsx` |
| School safety PDF report | ✅ | `schoolSafetyReportPdfBodySchema`; `reports/school-safety/page.tsx`; period reporting with incident breakdowns |
| After-action PDF | ✅ | `campus-after-action-pdf.ts`; per-incident PDF export |
| Incident reports page | ✅ | `reports/incidents/page.tsx` |
| Clery Act | 🚫 | Explicitly higher-ed only; `campus-clery-service.ts` is inaccessible to K-12 roles |
| State education safety reporting | ❌ | No adapter for state-specific reporting (CA K-12 SARC, ESSA, ESSA Title IV) |
| Drill compliance reports | ❌ | No drill tracking = no drill compliance report |
| Threat assessment records | ❌ | No BTAM records = no threat assessment reporting |
| FERPA-compliant data export | ❌ | No data export with FERPA redaction; analytics only |
| SIMFA / ICS reporting | ❌ | No NIMS/ICS-compliant incident command reporting |

---

## 9. Communications

| Feature | Status | Notes |
|---------|--------|-------|
| SMS intake (inbound) | ✅ | `campus-sms-intake-service.ts`; cold text → incident; thread continuation |
| SMS chat thread on incident | ✅ | `recordCampusChatMessage()`; bidirectional thread |
| Carrier location request | ✅ | `requestCarrierLocation()` called on new SMS incident |
| Broadcast push (staff) | ✅ | `PostCampusBroadcastFunction` |
| Notifications log | ✅ | `CampusNotificationLogTable`; `GET /api/campus/{agencyId}/notifications` |
| Parent/guardian notification | ❌ | No parent contact database; no parent-facing notification channel |
| Anonymous reporting tip line | ✅ | `POST /api/public/campus/report` with optional phone |
| Two-way parent SMS | ❌ | No opt-in parent SMS consent or two-way parent messaging |
| Staff app push notifications | 🔄 | SNS integration available platform-wide; no campus-specific push topic |

---

## 10. Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| QR code location intake | ✅ | `qr-nfc-service.ts`; `qr-nfc-incident-service.ts` |
| NFC tag location intake | ✅ | Same service handles NFC |
| SMS inbound routing | ✅ | Pinpoint inbound → campus handler |
| Security webhook (VMS/ALPR/alarm) | ✅ | `POST /api/public/campus/{campusCode}/security-events` |
| Amazon Location (GIS) | 🔄 | `location/client.ts`; `education-places.ts` with school POI search |
| Education POI search | ✅ | `education-places.ts`; `EDUCATION_POI_CATEGORIES`; nearby schools with GeoPlaces |
| CAD integration (read) | 🔄 | EventBridge `incident.created` from CAD account; campus does not write to CAD |
| Cognito identity | 🔄 | Shared Cognito pool; campus users get `custom:role = campus_*_k12` |
| Clery external sync | 🚫 | Higher-ed only |
| Raptor Technologies (visitor) | ❌ | No Raptor API adapter; NexCort iQ is a competing system |
| PowerSchool SIS | ❌ | No PowerSchool API integration |
| Infinite Campus SIS | ❌ | No Infinite Campus integration |
| Skyward SIS | ❌ | No Skyward integration |
| Aeries SIS | ❌ | No Aeries integration |
| CJIS background check (FBI/DOJ) | ❌ | No CJIS-authenticated background check; NSOPW is public non-CJIS |
| ID scanner (DL/passport OCR) | ❌ | No physical ID scanner integration or OCR API for visitor ID |
| Mass notification (Everbridge, etc.) | ❌ | No ENS third-party connector; campus broadcast uses internal Pinpoint |
| Dispatch assist / TipSoft | ❌ | No anonymous tip management platform connector |

---

## 11. Infrastructure

| Feature | Status | Notes |
|---------|--------|-------|
| Campus DynamoDB tables (config) | ✅ | `rapid-cortex-campus-config-{stage}` — pre-existing, managed via param workaround |
| Campus incidents table | ✅ | `CampusIncidentsTable` parameter in `stack-app-sam-5.yaml` |
| Campus visitors table | ✅ | `CampusVisitorsTable`; guarded by `HasCampusK12Tables` condition |
| Campus pickup auth table | ✅ | `CampusPickupAuthTable`; guarded by `HasCampusK12Tables` condition |
| Campus camera registry table | ✅ | `CampusCameraRegistryTable` |
| Campus bluelight poles table | ✅ | `CampusBlueLightPolesTable` |
| Campus notification log table | ✅ | `CampusNotificationLogTable` |
| K-12 SAM stack (dedicated) | ❌ | No `stack-app-sam-k12.yaml`; campus routes live in `stack-app-sam-5.yaml` |
| Volunteer/contractor table | ❌ | No DynamoDB table for volunteer/contractor records |
| Behavioral threat assessment table | ❌ | No DynamoDB table for BTAM cases |
| Safety drill table | ❌ | No DynamoDB table for drill scheduling/compliance |
| Parent contact / notification table | ❌ | No DynamoDB table for parent/guardian consent or contacts |
| Feature flags (K-12 specific) | ⚠️ | `ENABLE_CAMPUS_ALERTS=false` exists; no K-12-specific flags like `ENABLE_K12_VOLUNTEER_MGMT` |
| Campus feature table (not env flag) | ✅ | Tenant-level feature enable in campus config (`campusAlerts.enabled`, etc.) |

---

## 12. Frontend Pages

| Page | Status | Route |
|------|--------|-------|
| Campus dashboard (home) | ✅ | `/app/campus/[campusCode]/` |
| Incidents queue | ✅ | `/app/campus/[campusCode]/incidents` |
| Visitor verification | ✅ | `/app/campus/[campusCode]/visitors` |
| Pickup authorization | ✅ | `/app/campus/[campusCode]/pickup-auth` |
| Sites / schools list | ✅ | `/app/campus/[campusCode]/sites` |
| Site detail | ✅ | `/app/campus/[campusCode]/sites/[siteCode]` |
| Buildings | ✅ | `/app/campus/[campusCode]/buildings` |
| Zones | ✅ | `/app/campus/[campusCode]/zones` |
| Analytics | ✅ | `/app/campus/[campusCode]/analytics` |
| Reports (top-level) | ✅ | `/app/campus/[campusCode]/reports` |
| Incident reports | ✅ | `/app/campus/[campusCode]/reports/incidents` |
| School safety PDF report | ✅ | `/app/campus/[campusCode]/reports/school-safety` |
| Camera views | ✅ | `/app/campus/[campusCode]/cameras` |
| Video wall | ✅ | `/app/campus/[campusCode]/video-wall` |
| Vision AI | ✅ | `/app/campus/[campusCode]/vision-ai` |
| Translate | ✅ | `/app/campus/[campusCode]/translate` |
| War rooms | ✅ | `/app/campus/[campusCode]/war-rooms` (feature-flagged) |
| Escort iQ | ✅ | `/app/campus/[campusCode]/escort-iq` |
| EAP (Emergency Action Plans) | ✅ | `/app/campus/[campusCode]/eap` |
| QR codes | ✅ | `/app/campus/[campusCode]/qr-codes` |
| SMS numbers | ✅ | `/app/campus/[campusCode]/sms-numbers` |
| Users management | ✅ | `/app/campus/[campusCode]/users` |
| Settings | ✅ | `/app/campus/[campusCode]/settings` |
| Onboarding checklist | ✅ | `/app/campus/[campusCode]/onboarding/checklist` |
| Staff guide | ✅ | `/app/campus/[campusCode]/staff-guide` |
| Campus alerts (higher-ed) | 🚫 | `/app/campus/[campusCode]/campus-alerts` — higher-ed only |
| Clery pages | 🚫 | `/app/campus/[campusCode]/clery/*` — higher-ed only |
| Counselor dashboard | ⚠️ | `/app/campus/counselor` — page exists; content completeness not verified |
| Faculty dashboard | ✅ | `/app/campus/faculty` — pickup-auth focused |
| Security dashboard | ✅ | `/app/campus/security` |
| Dispatch dashboard | ✅ | `/app/campus/dispatch` |
| Supervisor dashboard | ✅ | `/app/campus/supervisor` |
| Volunteer management | ❌ | Not built |
| Behavioral threat assessment | ❌ | Not built |
| Safety drill tracker | ❌ | Not built |
| District command center | ❌ | `DistrictSchoolsPanel` exists as a component but no dedicated command page |
| Anonymous tip inbox | ❌ | Not built |

---

## 13. Demo / Synthetic Tenant

| Feature | Status | Notes |
|---------|--------|-------|
| San Ysidro SD demo tenant | ❌ | No K-12 demo agency seeded |
| Demo data scripts | ❌ | No K-12 seed scripts |
| Demo safety mode (no real alerts) | 🔄 | Platform has demo mode flag infrastructure; no K-12 demo guard |
| Demo QR codes | ❌ | No pre-generated QR codes for San Ysidro SD schools |

---

## Summary Matrix

| Domain | Implemented | Incomplete | Missing |
|--------|-------------|------------|---------|
| Roles | 6/6 K-12 roles | — | 5 new K-12 roles |
| Visitor Management | NSOPW, check-in, log | Photo capture, analytics | Badge print, volunteer mgmt, sign-out |
| Pickup Authorization | Records, restricted list | Photo workflow | Court order docs, dismissal tracking |
| Incident Reporting | Full K-12 catalog, QR/SMS/manual | Tip inbox, counselor notify | Parent notification, case linking |
| Emergency Operations | Silent panic, threat level, EAP, war rooms | Multi-school lockdown | Drill tracking, reunification, roll call |
| Counselor / Wellness | Queue, role RBAC | Counselor UI verification | BTAM, mandatory reporter, safe-to-return |
| Intelligence / Cameras | Full camera stack, Vision AI, bluelight | — | — |
| Reporting | School safety PDF, analytics | — | Drill compliance, BTAM records, FERPA export |
| Communications | SMS intake, broadcast | Push notifications | Parent notification, two-way parent SMS |
| Integrations | QR/NFC, SMS, VMS webhook, GIS | — | SIS (PowerSchool/IC/Skyward), ID scanner |
| Infrastructure | 7 DynamoDB tables, 50+ Lambda functions | Feature flags | Volunteer table, BTAM table, drill table |
| Frontend | 30+ pages | Counselor dashboard | Volunteer, BTAM, drill, tip inbox, district CMD |

---

## Implementation Priority (Phase 2)

Based on gap analysis and competitive differentiation against Raptor Technologies:

### Priority 1 — Table-stake gaps (block GA for K-12)
1. **Volunteer/contractor management** — Required for school compliance; Raptor's #1 feature
2. **Digital badge printing** — Required for visitor check-in workflow completion
3. **Counselor queue UI verification** — Types + API exist; confirm frontend completeness
4. **Anonymous tip inbox** — Intake works; need management surface for staff

### Priority 2 — Competitive differentiation
5. **Behavioral threat assessment (BTAM)** — CISA TAF workflow; differentiator vs Raptor
6. **Safety drill scheduling and compliance** — Required by most state fire codes; Raptor has this
7. **Reunification management** — Requested in every K-12 RFP; no competitor does it well

### Priority 3 — Integration depth
8. **SIS integration** (PowerSchool first) — Needed to link incidents to student records
9. **Parent/guardian notification** — High-value; needs parent consent infrastructure first
10. **District command center** — Multi-school operational view; differentiator for district admins

### Priority 4 — Demo readiness
11. **San Ysidro SD synthetic tenant** — Required for sales demos; no live data

---

## Files Reviewed

| File | Purpose |
|------|---------|
| `packages/shared/src/auth/rapid-cortex-roles.ts` | K-12 role definitions |
| `packages/shared/src/campus/institution-type.ts` | K-12 / higher-ed separation |
| `packages/shared/src/campus/district-school.ts` | District school model |
| `packages/shared/src/campus/campus-sites.ts` | CampusSite type |
| `packages/shared/src/campus/k12-intake.ts` | K-12 incident group taxonomy |
| `packages/shared/src/campus/incident-types.ts` | Full K-12 + higher-ed incident type catalog |
| `packages/shared/src/campus/nsopw-client.ts` | Sex offender screening |
| `packages/shared/src/campus/silent-panic.ts` | Silent panic schema |
| `packages/shared/src/campus/school-safety-report-schemas.ts` | PDF report schema |
| `packages/shared/src/campus/security-event-schemas.ts` | VMS/ALPR webhook schema |
| `packages/shared/src/campus/eap-schemas.ts` | Emergency Action Plan schemas |
| `packages/shared/src/campus/counselor-queue.ts` | Counselor queue type definitions |
| `apps/api/src/campus/campus-visitors-service.ts` | Visitor check-in + NSOPW |
| `apps/api/src/campus/campus-pickup-service.ts` | Student pickup authorization |
| `apps/api/src/campus/campus-incident-service.ts` | Incident CRUD + counselor filter |
| `apps/api/src/campus/campus-config-service.ts` | Campus config + buildings + zones |
| `apps/api/src/campus/campus-schemas.ts` | Campus incident + silent panic schemas |
| `apps/api/src/campus/campus-sms-intake-service.ts` | SMS inbound incident handling |
| `apps/api/src/campus/campus-access.ts` | Campus RBAC + tenant resolution |
| `infra/nested/stack-app-sam-5.yaml` | Campus Lambda registrations + routes (65 routes) |
| `infra/nested/stack-data-layer.yaml` | Campus DynamoDB table parameters |
| `apps/web/lib/navigation/role-nav.ts` | Campus K-12 navigation |
| `apps/web/app/app/campus/` | 50+ campus frontend pages |
| `apps/web/components/campus/k12/` | DistrictSchoolsPanel, SilentPanicPanel, CampusK12Banner |
| `docs/CAMPUS_ALERTS_ARCHITECTURE.md` | Campus alerts policy (higher-ed only) |
| `docs/admin-user-management/CAMPUS_OPERATIONS_GUIDE.md` | Campus operations guide |
| `docs/role-dashboard-spec.md` | Role dashboard spec (Section 3: Campus roles) |
