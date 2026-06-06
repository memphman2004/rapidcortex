# Admin setup guide

**Audience:** agency `admin` users and Rapid Cortex operators helping them. RBAC: [ADMIN_GUIDE.md](./ADMIN_GUIDE.md), [API_SURFACE.md](./API_SURFACE.md).

## Where to work in the product

| Goal | Route | API / behavior |
|------|-------|----------------|
| Onboarding docs + trackers | `/{slug}/admin/pilot` | Static + `localStorage` only |
| **Web flags + integration posture (read-only)** | `/{slug}/admin/configuration` | `NEXT_PUBLIC_*` snapshot + `GET /api/integration/status` |
| Users | `/{slug}/admin/users` | Cognito via `/api/admin/users` |
| Audit | `/{slug}/admin/audit` | `GET /api/audit/events` |
| Integrations (same status payload as Configuration) | `/{slug}/admin/integrations` | `GET /api/integration/status` |
| Environment reference (compliance map) | `/{slug}/admin/settings` | Static operator map |

## Preconditions

1. **API connected** in the browser (`NEXT_PUBLIC_AUTH_PROXY=1` + `API_UPSTREAM_BASE`, or `NEXT_PUBLIC_API_BASE`). Without this, user and audit screens show an explicit offline message — not hidden demo data.
2. Your Cognito user has **`custom:role=admin`** (or `platform_superadmin` for cross-agency operations).

## User provisioning (summary)

See **[USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)**. In-app: create user with email, **agency ID**, role, temporary password; directory lists agency-scoped users; **Save** updates `custom:agencyId` / `custom:role`; **Deactivate** disables sign-in.

**Outside the UI today:** re-enabling a disabled user (`AdminEnableUser`), assigning `readonly_auditor`, or `analyst` — use Amazon Cognito console/APIs or your runbook ([AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)).

## Audit and compliance

- Audit table loads real events or shows a **clear error** (403 = wrong role; network = message).
- Details column may truncate; full payloads are operator tools ([AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md)).

## Pilot feature flags (web)

Agency admins can **see** browser-visible flags on **Admin → Configuration**. They do **not** edit Lambda AI or multilingual secrets from the web app — that is **internal / DevOps** ([FEATURE_FLAGS.md](./FEATURE_FLAGS.md), [AGENCY_CONFIGURATION_GUIDE.md](./AGENCY_CONFIGURATION_GUIDE.md)).

## Transcript / AI / multilingual visibility

- **Dispatcher workspace** (`/{slug}/dashboard`): live transcript lines, AI intelligence panel, and per-segment interpreter/confidence UI when the pipeline populates those fields.
- **Admin → Configuration / Integrations**: summarized **AI provider chain**, **multilingual strict mode**, **issue count**, STT/LID/translation tier labels — not per-call transcripts.

## Related

- [ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md)
- [CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md)
- [PILOT_CONFIGURATION_MODEL.md](./PILOT_CONFIGURATION_MODEL.md)
