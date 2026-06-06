# Rapid Cortex — Multi-tenant SaaS specification (Agencies, users, invites, RBAC)

This document is the canonical reference for city/municipality onboarding, provisioning, and authorization. It is **CJIS-aligned** (controls and evidence) — **not** a compliance certification claim.

---

## SECTION 1 — Executive Summary

Rapid Cortex is a multi-tenant SaaS: every customer organization is an **Agency** (tenant). All operational and configuration data is scoped by **`agencyId`**. **Cognito ID tokens** supply `sub`, `email`, **`custom:agencyId`**, and **`custom:role`**. The **backend is authoritative** for authorization; the UI mirrors RBAC for UX only.

A **platform_superadmin** (internal staff) uses a dedicated role and a sentinel tenant id (`__platform__`) in JWT claims so the same `UserContext` shape holds for all principals. Platform users bypass **read** tenant boundaries only on explicitly allow-listed operations (e.g. list agencies, read any incident when `agencyId` query is absent policy — see implementation: cross-tenant incident list requires `agencyId` query for platform).

---

## SECTION 2 — Multi-Tenant Architecture Model

- **Tenant = Agency** — one row per city/county/regional center.
- **AgencyConfig** — logical configuration (may be embedded in the agency item or split later).
- **Explicit `agencyId`** on incidents, transcripts, analyses, audit rows, invites, and future integration configs.
- **No email-domain tenancy** — domain may be a UX hint only; **never** a security boundary.
- **DynamoDB** (current stack): dedicated **Agencies** and **Invites** tables; existing incidents/transcripts/analyses/audit unchanged.

---

## SECTION 3 — Role and Authorization Matrix

| Action | dispatcher | supervisor | admin | platform_superadmin | analyst (future) | readonly_auditor (future) |
|--------|:----------:|:----------:|:-----:|:-------------------:|:------------------:|:-------------------------:|
| Dispatch / own-agency incidents | ✓ | ✓ | ✓ | ✗ | ✓* | ✓* |
| Supervisor review / queue | ✗ | ✓ | ✓ | ✗ | partial | ✓ |
| Agency admin UI (users, settings) | ✗ | ✗ | ✓ | ✗ | ✗ | read-only* |
| Create / suspend **agency** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| List all agencies | ✗ | ✗ | ✗ | ✓ | ✗ | optional |
| Invite user (same agency) | ✗ | ✗ | ✓ | ✓ (any agency) | ✗ | ✗ |
| Cross-agency incident **read** | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Cross-agency incident **list** | ✗ | ✗ | ✗ | ✓ with `?agencyId=` | ✗ | ✗ |

\*Future: narrow via `permissionsOverride` on a user profile store.

---

## SECTION 4 — Data Model

### Agency (Dynamo)

- **PK**: `agencyId` (string)
- **Attributes**: see `AgencyTenant` in `packages/shared/src/tenancy/agency.ts`
- **GSI**: `status-createdAt-index` — PK `status`, SK `createdAt` (list agencies by lifecycle)

### AgencyConfig

- **Embedded** in agency item under `config` (version 1) to reduce table sprawl; can split to `PK=agencyId, SK=config` later.

### Invite (Dynamo)

- **PK**: `inviteId`
- **GSI**: `agencyId-status-index` — PK `agencyId`, SK `createdAt`
- **Lifecycle**: pending → accepted | expired | revoked

### User (logical)

- **Source of truth for auth**: Cognito user + claims.
- **Extended profile** (firstName, invitedBy, lastLogin): future **UserProfile** table or sync from IdP; types stubbed in `user-profile.ts`.

### AuditEvent

- Existing table; extend `type` with tenant-admin strings (`agency.created`, `invite.created`, …) via `AUDIT_EVENT_TYPES` in security package.

---

## SECTION 5 — Cognito Claim and Auth Model

- **Expected ID token claims**: `sub`, `email`, `custom:agencyId`, `custom:role`
- **platform_superadmin**: set `custom:role=platform_superadmin` and `custom:agencyId=__platform__` (or empty → server maps to `__platform__`).
- **Session**: Next.js httpOnly cookies; server verifies JWT for `/api/me` and BFF proxy attaches Bearer to API.
- **Invite acceptance**: production = magic link + `AdminCreateUser` / `AdminSetUserPassword` + attribute update; starter code persists **Invite** and uses existing admin create user path for manual bootstrap.

---

## SECTION 6 — New Agency Onboarding Flow

1. Platform superadmin calls `POST /api/agencies` → agency + default config persisted → audit `agency.created`.
2. `POST /api/agencies/:id/invites` with role `admin` for initial municipal admin → invite pending.
3. Invitee receives credentials out-of-band (pilot) or future email link.
4. On first login, Cognito `FORCE_CHANGE_PASSWORD` completes; claims carry `agencyId` + role.
5. Agency admin invites dispatchers/supervisors via existing admin user APIs (tightened to same-agency) + invite records for audit trail.

**Failures**: duplicate `agencyId` → 409; suspended agency → 403 on mutating routes; expired invite → 410 on accept (stub).

---

## SECTION 7 — User Provisioning and Invite Flow

- **Who invites**: agency `admin` (same `agencyId` only) or `platform_superadmin` (any agency).
- **Validations**: email format, role ∈ agency roles, agency `status` allows invites.
- **Audit**: `invite.created`, `invite.revoked`, `admin.user.create` (existing).

---

## SECTION 8 — Frontend Admin UX

Public web URLs use **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`**; table below shows the **path after** that slug.

| Screen | Purpose | Roles |
|--------|---------|-------|
| `/<slug>/admin/platform/agencies` | List + link to create/detail | platform_superadmin |
| `/<slug>/admin/platform/agencies/new` | Create agency form | platform_superadmin |
| `/<slug>/admin/platform/agencies/[id]` | Detail + invites list + “new invite” | platform_superadmin |
| Existing `/<slug>/admin/users` | User ops | agency admin (filtered) — extend later for platform |

Empty/loading/error states follow existing admin styling.

---

## SECTION 9 — Backend API Design

| Route | Method | Roles | Notes |
|-------|--------|-------|-------|
| `/api/me` | GET | any auth | Returns `UserContext` + `principalKind` |
| `/api/agencies` | GET | platform | List agencies (by GSI) |
| `/api/agencies` | POST | platform | Create agency |
| `/api/agencies/{id}` | GET | platform; agency admin (own) | |
| `/api/agencies/{id}` | PATCH | platform; agency admin (limited) | Status suspension: platform only |
| `/api/agencies/{id}/invites` | GET | platform; agency admin (own) | |
| `/api/agencies/{id}/invites` | POST | platform; agency admin (own) | Body: email, role, optional expiresInDays |

Existing `/api/admin/users` remains; service layer filters rows for agency admins.

---

## SECTION 10 — Audit and Security Model

- Extend `AUDIT_EVENT_TYPES` with agency/invite lifecycle events.
- **Actor** = `actorId` (Cognito `sub`), **agency scope** = target agency for tenant admin actions.
- **Access denied** (optional): log `authz.access_denied` with reason code (future).

---

## SECTION 11 — Repository Structure

See **SECTION 12** file tree in code: `packages/shared/src/tenancy/*`, `apps/api/src/repositories/agencyRepository.ts`, `inviteRepository.ts`, `services/agencyService.ts`, `handlers/*Agency*.ts`, `apps/web/app/[jurisdiction]/(dispatch)/admin/platform/agencies/*`.

---

## SECTION 12 — Starter TypeScript Scaffolding

Implemented in repo (types, zod, services, handlers, SAM, admin UI stubs, examples JSON).

---

## SECTION 13 — Recommended Build Order

1. Shared types + Zod + constants  
2. Auth claim mapping + `getUserContext`  
3. Security `AuthorizationService` / `TenantAccessGuard` / incident list/get policy  
4. Dynamo tables + repositories + `AgencyService`  
5. HTTP handlers + SAM  
6. Admin UI (platform)  
7. Invite accept + email + UserProfile table  
8. Hardening tests for every route  

---

## SECTION 14 — Cursor Implementation Pass Plan

- **Pass 1**: ✅ `packages/shared/src/tenancy/*`  
- **Pass 2**: ✅ security + `auth.ts` / `authz.ts` / `incidentService` / `adminUserService`  
- **Pass 3**: ✅ agencies/invites/me handlers + SAM  
- **Pass 4**: ✅ `/<slug>/admin/platform/agencies` routes (under `https://www.rapidcortex.us/<slug>/…`)  
- **Pass 5**: ✅ `docs/examples/tenancy-seed.examples.json`  

Next passes (follow-up): invite accept API, SES templates, UserProfile Dynamo table, integration tests, Cognito Hosted UI MFA policy.
