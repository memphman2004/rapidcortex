# NexCort iQ K–12 — Implementation Status

**Last updated:** November 2026  
**Status key:** ✅ Done · ⚠️ Partial · 🔧 In progress · ❌ Not started · 🚫 Blocked

---

## Phase 1 — Repository Audit & Documentation

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Repository audit | ✅ | Full audit of campus vertical; documented in PLATFORM_CAPABILITY_AUDIT.md |
| docs/k12/PLATFORM_CAPABILITY_AUDIT.md | ✅ | Complete capability matrix with 13 domains |
| docs/k12/K12_ARCHITECTURE.md | ✅ | Architecture, Lambda inventory, DynamoDB tables, auth/RBAC |
| docs/k12/VISITOR_MANAGEMENT.md | ✅ | Current state + Phase 2 designs for volunteer mgmt, badge printing, sign-out |
| docs/k12/STUDENT_SAFETY.md | ✅ | Pickup auth, incident reporting, counselor queue, BTAM design, drills design |
| docs/k12/EMERGENCY_OPERATIONS.md | ✅ | Silent panic, threat level, EAP, district panel, missing: drills, reunification |
| docs/k12/INTEGRATION_MATRIX.md | ✅ | All integrations: live, planned, out of scope |
| docs/k12/SECURITY_AND_PRIVACY.md | ✅ | FERPA, COPPA, audit logging, tenant isolation, demo safety rules |
| docs/k12/RAPTOR_COMPETITIVE_GAP_ANALYSIS.md | ✅ | Feature-by-feature Raptor comparison + differentiators |
| docs/k12/DEMO_RUNBOOK.md | ✅ | 20-min demo flow, talking points, objection handling |
| docs/k12/IMPLEMENTATION_STATUS.md | ✅ | This document |

---

## Phase 2 — Priority 1: Table-Stake Gaps

### 2.1 Volunteer & Contractor Management

**Status:** ❌ Not started  
**Priority:** Critical (blocks K-12 district sales)  
**Estimated effort:** 3–5 days

**What needs to be built:**
- [ ] `packages/shared/src/campus/volunteer-schemas.ts` — `volunteerRecordSchema`, routes schema
- [ ] `CAMPUS_VOLUNTEERS_TABLE` DynamoDB table in `stack-data-layer.yaml`
- [ ] `apps/api/src/campus/campus-volunteers-service.ts` — CRUD + NSOPW re-check
- [ ] Lambda handler(s) in `stack-app-sam-5.yaml` or new function
- [ ] Routes: `GET/POST /api/campus/{agencyId}/volunteers`, `GET/PATCH /api/campus/{agencyId}/volunteers/{id}`, `POST /api/campus/{agencyId}/volunteers/{id}/nsopw-check`
- [ ] IAM policy update for new table
- [ ] Frontend: `/app/campus/[campusCode]/volunteers/page.tsx`
- [ ] Navigation item in `role-nav.ts` for admin/supervisor

**Key design decisions:**
- Volunteer vs. visitor: volunteer has recurring clearance; visitor is one-time check
- Background check status is **recorded** by NexCort iQ but conducted by district HR or state DOJ
- NSOPW re-run is free (public API); re-check threshold: 30 days

---

### 2.2 Digital Badge Printing

**Status:** ❌ Not started  
**Priority:** High (expected in every demo)  
**Estimated effort:** 1–2 days

**What needs to be built:**
- [ ] `GET /api/campus/{agencyId}/visitors/{visitId}/badge-pdf` Lambda handler
- [ ] pdfkit badge layout: 3"×4" Dymo-compatible + 8.5"×11" fallback
- [ ] Frontend: "Print badge" button on successful check-in in `visitor-verification-client.tsx`
- [ ] Badge fields: visitor name, photo (if available), date, school, purpose, clearance indicator

---

### 2.3 Visitor Sign-Out

**Status:** ❌ Not started  
**Priority:** High  
**Estimated effort:** 0.5 days

**What needs to be built:**
- [ ] Schema addition: `checkedOutAt?: string` on visitor record
- [ ] `PATCH /api/campus/{agencyId}/visitors/{visitId}/sign-out` route + handler
- [ ] Frontend: sign-out button in visitor log
- [ ] Dashboard widget: "Active visitors on campus right now: N"

---

### 2.4 Anonymous Tip Inbox UI

**Status:** ⚠️ Intake works; review UI missing  
**Priority:** High  
**Estimated effort:** 1 day

**What exists:** `POST /api/public/campus/report` creates incidents with `source: "qr"` or `source: "sms"`. These incidents appear in the main incident queue.

**What needs to be built:**
- [ ] Filter in incident list UI for `source: "qr" | "sms"` with "anonymous tip" label
- [ ] Dedicated "Tips" navigation item (or subsection in Incidents)
- [ ] "Reviewed" / "Acted on" / "No action needed" tip status (beyond incident status)
- [ ] Tip volume analytics widget for admin dashboard

---

### 2.5 Counselor Queue UI Verification

**Status:** ⚠️ Backend complete; frontend not fully verified  
**Priority:** Medium  
**Estimated effort:** 0.5 days

**What exists:** `/app/campus/counselor/page.tsx` and backend filter  
**Action needed:**
- [ ] Read `/app/campus/counselor/page.tsx` and verify it calls `GET /api/campus/incidents?queue=counselor`
- [ ] Verify counselor cannot navigate to full incident list
- [ ] Add counselor notification (browser push or in-app badge) when new mental health incident is created

---

## Phase 2 — Priority 2: Competitive Differentiators

### 2.6 Behavioral Threat Assessment (BTAM)

**Status:** ❌ Not started  
**Priority:** High (post-Uvalde requirement in many districts)  
**Estimated effort:** 5–7 days

**What needs to be built:**
- [ ] `packages/shared/src/campus/btam-schemas.ts` (see STUDENT_SAFETY.md for design)
- [ ] `CAMPUS_BTAM_TABLE` in `stack-data-layer.yaml`
- [ ] `apps/api/src/campus/campus-btam-service.ts`
- [ ] CRUD routes + note/intervention routes
- [ ] Frontend: `/app/campus/[campusCode]/threat-assessment/page.tsx`
- [ ] AI guardrail enforcement: label all AI suggestions as advisory
- [ ] RBAC: BTAM visible only to admin, supervisor, designated TAT members

---

### 2.7 Safety Drill Scheduling & Compliance

**Status:** ❌ Not started  
**Priority:** High (state compliance requirement)  
**Estimated effort:** 3–4 days

**What needs to be built:**
- [ ] `packages/shared/src/campus/drill-schemas.ts` (see STUDENT_SAFETY.md for design)
- [ ] `CAMPUS_DRILLS_TABLE` in `stack-data-layer.yaml`
- [ ] `apps/api/src/campus/campus-drills-service.ts`
- [ ] Routes: `GET/POST /api/campus/{agencyId}/drills`, `GET /api/campus/{agencyId}/drills/compliance`
- [ ] Frontend: `/app/campus/[campusCode]/drills/page.tsx` with compliance calendar
- [ ] State requirement presets (CA, TX, FL, NY, NJ) with required drill counts per type

---

## Phase 2 — Priority 3: Emergency Completeness

### 2.8 Student Reunification

**Status:** ❌ Not started  
**Priority:** High (every K-12 RFP asks)  
**Estimated effort:** 4–5 days

**Prerequisites:** SIS integration (for roster) OR manual student list upload

**What needs to be built:**
- [ ] Reunification session linked to incident
- [ ] Student status: `in_care` / `released` / `unaccounted` / `medical_transport`
- [ ] Guardian match against pickup auth records
- [ ] Real-time accountability count dashboard
- [ ] `POST /api/campus/{agencyId}/incidents/{incidentId}/reunification/start`

---

### 2.9 District-Wide Simultaneous Lockdown

**Status:** ⚠️ Partial (per-school only)  
**Priority:** Medium  
**Estimated effort:** 2 days

**What needs to be built:**
- [ ] District code concept (links multiple `agencyId` records)
- [ ] `PATCH /api/campus/district/{districtCode}/threat-level` with SQS fan-out
- [ ] Fan-out updates all site threat levels within 2 seconds

---

## Phase 3 — SIS Integration

### 3.1 Clever Roster Sync

**Status:** ❌ Not started  
**Priority:** Medium (fastest SIS path)  
**Estimated effort:** 3–4 days + vendor app approval

**What needs to be built:**
- [ ] Clever OAuth app registration
- [ ] `GET /api/campus/{agencyId}/integrations/clever/sync` — pull students + guardians
- [ ] Map to pickup auth records
- [ ] Nightly sync via EventBridge scheduled rule

---

### 3.2 Manual CSV Roster Upload

**Status:** ❌ Not started  
**Priority:** Medium (interim before SIS)  
**Estimated effort:** 2 days

**What needs to be built:**
- [ ] CSV template: `studentId, firstName, lastName, grade, guardian1Name, guardian1Phone, guardian2Name, guardian2Phone`
- [ ] `POST /api/campus/{agencyId}/roster/upload` — validate CSV, upsert pickup auth records
- [ ] Frontend: upload widget in Pickup Authorization page

---

### 3.3 PowerSchool Native Integration

**Status:** ❌ Not started  
**Priority:** High (most common US K-12 SIS)  
**Estimated effort:** 5–7 days + district API credentials

---

## Phase 6 — Demo Tenant

### 6.1 San Ysidro School District Synthetic Tenant

**Status:** ❌ Not started  
**Priority:** High (required for sales demos)  
**Estimated effort:** 1 day

**What needs to be built:**
- [ ] `scripts/seed-demo-k12-tenant.ts` — creates agency record, 4 school sites, demo users
- [ ] Seeds: 10+ synthetic incidents, 12 synthetic visitors, 3 pickup auth records
- [ ] Cognito staging users for 6 demo roles
- [ ] `NSOPW_MOCK=1` fixture: "John Smith" → cleared, "James Williams" → review_required
- [ ] Safe to run in CI without affecting any live tenant

---

## Deployment Notes

**All Phase 2 changes require:**
1. Schema additions to `packages/shared` (new Zod schemas)
2. Table additions to `infra/nested/stack-data-layer.yaml` (DynamoDB table parameter)
3. IAM policy shard updates in `stack-app-sam-2.yaml` (new table ARNs)
4. Lambda handler additions or route additions in `stack-app-sam-5.yaml`
5. `sam validate --lint` on all changed nested stack files
6. `python3 scripts/check-iam-managed-policy-sizes.py --headroom 512`
7. `python3 scripts/check-iam-novalue-resources.py`
8. Frontend pages in `apps/web/app/app/campus/[campusCode]/`
9. Navigation item additions in `apps/web/lib/navigation/role-nav.ts`

**Do not deploy to production without explicit authorization. All K-12 features affecting student records, visitor data, or emergency systems require human approval before production release.**

---

## Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Which SIS integration to build first? (PowerSchool vs. Clever CSV) | Product | Undecided |
| Is Alyssa's Law direct PSAP notification required for silent panic? | Legal | Undecided |
| BTAM case records — FERPA-restricted to TAT only or all campus admin? | Legal | Undecided |
| Volunteer background check integration — Checkr vs. manual status tracking? | Product | Undecided |
| Parent notification opt-in consent flow — in-platform or via district IT? | Product | Undecided |
| San Ysidro SD is a real district in CA — use as demo name or create fictional? | Sales | Undecided |

> ⚠️ **Note on San Ysidro SD:** San Ysidro School District is a real school district in San Diego, CA. Using their name in demo materials without their consent could create confusion. Consider using a clearly fictional district name: "Maplewood Unified School District" or "Lincoln Heights School District."
