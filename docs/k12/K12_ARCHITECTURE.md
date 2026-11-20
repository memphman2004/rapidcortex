# NexCort iQ K–12 — Architecture

**Product vertical:** NexCort iQ Campus (K–12 institution type)  
**AWS Account:** 158961537080 (nexcortiq-prod)  
**Last updated:** November 2026

---

## Overview

The K–12 platform is implemented as a **feature layer within the existing Campus product vertical**. It shares the same Lambda stack (`stack-app-sam-5.yaml`), DynamoDB tables, and Next.js routes as the higher-ed (Clery) campus product, differentiated by:

1. **Institution type:** `campusInstitutionType = "k12"` on the agency record
2. **Role suffix:** `campus_*_k12` roles (vs `campus_*_highered`)  
3. **Feature gates:** K-12-specific features appear/hide based on institution type; Clery routes are blocked for K-12

There is no separate K-12 CloudFormation stack. All campus Lambda functions serve both K-12 and higher-ed tenants.

---

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Reporters / Staff / Public                                                      │
│                                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Staff web   │  │  QR/NFC scan │  │  SMS text    │  │ Security webhook     │ │
│  │  console     │  │  (phone cam) │  │  to campus # │  │ (VMS/ALPR/alarm)    │ │
│  │  /app/campus │  │  public report│ │              │  │                      │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────┼────────────────────┼─────────────┘
          │                 │                 │                    │
          ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  AWS API Gateway v2 (HTTP API)                                                   │
│  ├── /app/* → Next.js ECS (BFF)                                                  │
│  ├── /api/campus/* → Campus Lambda functions (stack-app-sam-5.yaml)              │
│  ├── /api/public/campus/* → Public/anon campus endpoints                         │
│  └── /api/sms/* → Pinpoint inbound → SMS routing Lambda                          │
└───────────────────────────────┬─────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        ▼                       ▼                        ▼
┌────────────────┐   ┌─────────────────────┐  ┌──────────────────────┐
│  Cognito       │   │  Campus Lambdas     │  │  External Services   │
│  JWT auth      │   │  (Node.js 22)       │  │                      │
│  custom:role   │   │                     │  │  NSOPW.gov (public)  │
│  campus_*_k12  │   │  campus-incidents   │  │  Amazon Location GIS │
└────────────────┘   │  campus-visitors    │  │  Pinpoint SMS        │
                     │  campus-pickup      │  │  Bedrock AI          │
                     │  campus-eap         │  │  KVS (cameras)       │
                     │  campus-bluelight   │  └──────────────────────┘
                     │  campus-sms-intake  │
                     │  campus-sites       │
                     └────────┬────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
  ┌─────────────────┐  ┌──────────────┐  ┌────────────────────┐
  │  DynamoDB       │  │  S3 (media)  │  │  EventBridge       │
  │  Tables         │  │  incident    │  │  (CAD account →)   │
  │  (see below)    │  │  photos/docs │  │  incident.created  │
  └─────────────────┘  └──────────────┘  └────────────────────┘
```

---

## Lambda Functions (Campus / K-12)

All campus Lambda functions live in `infra/nested/stack-app-sam-5.yaml`. K-12-specific behavior is handled inside the function code based on institution type, not via separate functions.

### Core K-12 Functions

| Function | Handler | Routes |
|----------|---------|--------|
| `GetCampusStatsFunction` | `dist/handlers/campus/dashboard-handlers.getStats` | `GET /api/campus/{agencyId}/stats` |
| `CampusSitesFunction` | campus sites handler | `GET/PUT /api/campus/{agencyId}/sites` |
| `CampusK12Function` | campus K-12 handler | `GET /api/campus/{agencyId}/visitors`, `POST /api/campus/{agencyId}/visitors/check-in`, `GET/PUT /api/campus/{agencyId}/pickup-auth` |
| `GetCampusIncidentsFunction` | `get-campus-incidents` | `GET /api/campus/incidents` |
| `GetCampusIncidentFunction` | `get-campus-incident` | `GET /api/campus/incidents/{id}` |
| `PostCampusIncidentFunction` | `post-campus-incident` | `POST /api/campus/incidents` |
| `PatchCampusIncidentFunction` | `patch-campus-incident` | `PATCH /api/campus/incidents/{id}` |
| `PostCampusIncidentEscalateFunction` | `post-campus-incident-escalate` | `POST /api/campus/incidents/{id}/escalate` |
| `PostCampusIncidentNoteFunction` | `post-campus-incident-note` | `POST /api/campus/incidents/{id}/notes` |
| `PostCampusPublicReportFunction` | `post-campus-public-report` | `POST /api/public/campus/report` |
| `PostCampusSecurityEventFunction` | `post-campus-security-event` | `POST /api/public/campus/{campusCode}/security-events` |
| `PatchCampusThreatLevelFunction` | threat level handler | `GET/PATCH /api/campus/{agencyId}/threat-level` |
| `PostCampusBroadcastFunction` | broadcast handler | `POST /api/campus/{agencyId}/broadcast` |
| `GetCampusBuildingsDashboardFunction` | buildings handler | `GET /api/campus/{agencyId}/buildings`, `GET /api/campus/buildings` |
| `GetCampusZonesFunction` | zones handler | `GET/POST /api/campus/{agencyId}/zones` |
| `GetCampusAnalyticsFunction` | `get-campus-analytics` | `GET /api/campus/analytics` |
| `CampusEapHttpFunction` | `campus-eap-http` | `GET/POST/DELETE /api/campus/eap`, `GET /api/campus/eap/match` |
| `CampusCameraRegistryListCreateFunction` | camera registry | `GET/POST /api/campus/{agencyId}/cameras/registry` |
| `BlueLightGetPolesFunction` | bluelight handler | `GET /api/campus/bluelight/poles` |
| `BlueLightActivateFunction` | bluelight handler | `POST /api/campus/bluelight/activate` |

### Higher-Ed Only Functions (K-12 excluded)

| Function | Routes | Why K-12 excluded |
|----------|--------|-------------------|
| `CampusCleryHttpFunction` | `/api/campus/clery/*` | Clery Act applies to higher-ed institutions only |
| `CampusAlertsStaffHttpFunction` | `/api/campus/{campusCode}/campus-alerts/*` | Mass SMS alerts policy: higher-ed only |

---

## DynamoDB Tables

All tables use `rapid-cortex-{name}-{stage}` physical naming. Campus tables are pre-existing in dev (managed via CloudFormation parameter workaround in `stack-data-layer.yaml`).

| Logical Name | Physical Table (dev) | PK Pattern | SK Pattern | K-12 Use |
|-------------|---------------------|------------|------------|----------|
| `CAMPUS_CONFIG_TABLE` | `rapid-cortex-campus-config-dev` | `CAMPUS#{campusCode}` | `SETTINGS#` / `BUILDING#{id}` / `ZONE#{id}` | ✅ Config, buildings, zones, anon tokens |
| `CAMPUS_INCIDENTS_TABLE` | `rapid-cortex-campus-incidents-dev` | `CAMPUS#{campusCode}` | `INCIDENT#{id}` | ✅ All K-12 incidents |
| `CAMPUS_VISITORS_TABLE` | (parameter; guarded by `HasCampusK12Tables`) | `AGENCY#{agencyId}` | `VISIT#{dateKey}#{visitorId}` | ✅ Visitor check-in + NSOPW results |
| `CAMPUS_PICKUP_AUTH_TABLE` | (parameter; guarded by `HasCampusK12Tables`) | `AGENCY#{agencyId}` | `STUDENT#{studentId}` | ✅ Authorized pickup records |
| `CAMPUS_CAMERA_REGISTRY_TABLE` | (parameter) | `AGENCY#{agencyId}` | `CAMERA#{cameraId}` | ✅ Fixed camera registry |
| `CAMPUS_BLUELIGHT_POLES_TABLE` | (parameter) | `AGENCY#{agencyId}` | `POLE#{poleId}` | ✅ Bluelight pole registry |
| `CAMPUS_NOTIFICATION_LOG_TABLE` | (parameter) | `AGENCY#{agencyId}` | `NOTIF#{timestamp}#{id}` | ✅ Broadcast + notification log |

### Missing Tables (Phase 2)

| Needed For | Suggested Logical Name | PK / SK Pattern |
|-----------|----------------------|-----------------|
| Volunteer/contractor mgmt | `CAMPUS_VOLUNTEERS_TABLE` | `AGENCY#{agencyId}` / `VOL#{volunteerId}` |
| Behavioral threat assessment | `CAMPUS_BTAM_TABLE` | `AGENCY#{agencyId}` / `CASE#{caseId}` |
| Safety drill tracking | `CAMPUS_DRILLS_TABLE` | `AGENCY#{agencyId}` / `DRILL#{drillId}` |
| Parent/guardian contacts | `CAMPUS_PARENT_CONTACTS_TABLE` | `AGENCY#{agencyId}` / `PARENT#{contactId}` |

---

## Authentication & Authorization

### Identity
- All campus users are authenticated via **AWS Cognito** (User Pool `us-east-1_0z6tA6WBs`)
- JWT claims: `custom:role = campus_admin_k12`, `custom:agencyId = campus-{code}`
- Role normalization: `normalizeSessionRole()` preserves `campus_*_k12` before PSAP migration; never call `migrateLegacyRapidCortexRoleTokenValue()` first

### RBAC at API layer
- `canAccessCampusTenant(user, campusCode)` from `campus-access.ts` — matches JWT agencyId to campusCode
- RC internal operators (`rcsuperadmin`, `rcadmin`) bypass tenant check
- Counselor role: restricted to `queue=counselor` incident view; cannot see unrelated incidents
- Faculty role: read-only pickup authorization; cannot create incidents

### K-12 Role Permission Matrix

| Action | admin_k12 | supervisor_k12 | security_k12 | dispatch_k12 | counselor_k12 | faculty_k12 |
|--------|-----------|----------------|--------------|--------------|---------------|-------------|
| Create incident | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (limited) |
| View all incidents | ✅ | ✅ | ✅ | ✅ | wellness only | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Visitor check-in | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Pickup authorization | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (read) |
| Silent panic | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Broadcast | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Settings / config | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| QR code management | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Multi-Tenant Isolation

Every DynamoDB operation is scoped to `agencyId`. The `agencyId` is **always read from the verified Cognito JWT** — never from URL parameters or request body.

```typescript
// Canonical pattern — campus-visitors-service.ts
const user = extractCallerFromToken(event);
const agencyId = user.agencyId; // from JWT, NOT event.pathParameters
await ddb.send(new PutCommand({
  TableName: campusVisitorsTable(),
  Item: { pk: `AGENCY#${agencyId}`, sk: `VISIT#${dateKey}#${visitorId}`, ... }
}));
```

Campus code ↔ agencyId resolution is handled by `resolveCampusAgencyId(campusCode)` for public/anonymous endpoints (QR scan, SMS intake) where there is no JWT.

---

## Feature Flag Architecture

### Env-level flags (Lambda environment variables)

| Flag | Default | Effect |
|------|---------|--------|
| `ENABLE_CAMPUS_ALERTS` | `false` (explicitly set in `env-api-dev.sh`) | Campus mass SMS alerts (higher-ed only) |
| `CAMPUS_INCIDENTS_TABLE` | empty → condition false | Campus incident features enabled when non-empty |
| `CAMPUS_VISITORS_TABLE` | empty → condition false | K-12 visitor/pickup features enabled when non-empty |

### Next.js / web flags

| Flag | Source | Default |
|------|--------|---------|
| `NEXT_PUBLIC_ENABLE_CAMPUS_ALERTS` | env var | varies |
| `isWarRoomsEnabled()` | `runtime-flags.ts` | on when env var unset |

### Tenant-level flags (DynamoDB config)

Stored in `CAMPUS_CONFIG_TABLE` under `CAMPUS#{code}#SETTINGS`:
- `campusAlerts.enabled` — higher-ed only; K-12 tenants should never have this set
- `institutionType` — `"k12"` or `"higher_ed"` — drives UI and API feature gating

---

## Frontend Architecture

### App Router structure
```
apps/web/app/app/campus/
  [campusCode]/          ← All pages for a specific campus tenant
    page.tsx             ← Dashboard (home)
    visitors/            ← Visitor verification (K-12)
    pickup-auth/         ← Pickup authorization (K-12)
    sites/               ← District schools list
    incidents/           ← Incident queue
    ...
  admin/                 ← RC admin cross-tenant campus admin
  counselor/             ← Counselor-role landing
  faculty/               ← Faculty-role landing
  security/              ← Security officer landing
  dispatch/              ← Campus dispatch landing
  supervisor/            ← Supervisor landing
```

### Institution type routing
`applyCampusInstitutionNav()` in `role-nav.ts` strips Clery-only nav items and injects the `k12-safety` section (Visitor Verification + Pickup Authorization) when `campusProduct === "k12"`.

### Key K-12 components
| Component | File | Purpose |
|-----------|------|---------|
| `DistrictSchoolsPanel` | `components/campus/k12/DistrictSchoolsPanel.tsx` | Multi-school list with grade badges + alert status |
| `SilentPanicPanel` | `components/campus/k12/SilentPanicPanel.tsx` | Silent panic activation UI |
| `CampusK12Banner` | `components/campus/k12/CampusK12Banner.tsx` | Amber "K-12 — NOT A 911 DISPATCH CONSOLE" banner |
| `VisitorVerificationClient` | `app/app/campus/[campusCode]/visitors/visitor-verification-client.tsx` | Visitor check-in + NSOPW result display |

---

## Public / Anonymous Intake Flow

### QR/NFC scan → incident
1. User scans QR code on campus signage → resolves to `/report?campus=CAMPUSCODE&rc=RCLI`
2. Frontend loads anonymous report form; `campusCode` and `rcli` from URL params
3. `POST /api/public/campus/report` with `{ campusCode, rcli, type, description, ... }`
4. `PostCampusPublicReportFunction` rate-limits by IP (5/hr), creates incident with QR location context
5. Incident appears in campus dispatch queue with `source: "qr"`

### SMS → incident
1. Reporter texts campus SMS number (Pinpoint)
2. Pinpoint → `AwsSmsInboundFunction` → `SmsRoutingHttpFunction` → identifies campus by phone number
3. `handleCampusInboundSms()` checks for existing open incident from same phone hash
4. New incident: `createCampusSmsIncident()` with `source: "sms"`, carrier location requested
5. Thread continuation: appends as `CampusSmsChatMessage`

---

## Integration Points

| System | Direction | Protocol | Purpose |
|--------|-----------|----------|---------|
| NSOPW.gov | outbound | HTTPS REST | Sex offender check on visitor check-in |
| Amazon Location GIS | outbound | AWS SDK | Education POI search, campus geocoding |
| Pinpoint | inbound (SMS) + outbound | AWS SDK | Inbound reports + broadcast SMS |
| KVS (cameras) | inbound + outbound | WebRTC/HLS | Live camera feeds, Rapid Vision |
| AWS Bedrock | outbound | AWS SDK | AI incident triage, EAP suggestions |
| CAD EventBridge | inbound | EventBridge cross-account | `incident.created` from CAD account |
| QR/NFC (location) | inbound | HTTPS | QR scan location context |
| Cognito | inbound | JWT | User authentication + RBAC |

---

## Deployment

Campus K-12 ships as part of the **main platform deploy**:

```bash
# Staging
source scripts/env-api-staging.sh && bash scripts/deploy.sh staging

# Production (live at app.rapidcortex.us)  
# MUST run from internal drive, not /Volumes/*
source scripts/env-api-dev.sh && bash scripts/deploy.sh dev
```

The `stack-app-sam-5.yaml` nested stack handles all campus Lambda deployments. Campus DynamoDB tables are pre-existing in dev; the data layer stack manages their ARN output parameters.

**Do not deploy K-12 features affecting visitor records, student data, or emergency notifications to production without explicit authorization.**
