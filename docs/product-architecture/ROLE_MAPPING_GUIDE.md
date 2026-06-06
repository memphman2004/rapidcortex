# Role mapping guide (Cognito `custom:role`)

**Security boundary:** JWT claims (`custom:agencyId`, `custom:role`) + API — **not** the URL jurisdiction slug ([USER_GUIDE.md](./USER_GUIDE.md)).

## Roles in the product model

| `custom:role` | Typical duties | Admin UI provisioning |
|---------------|------------------|-------------------------|
| `dispatcher` | Dashboard, transcript, intelligence, dispatch actions | **Yes** (in-app) |
| `supervisor` | Review + audit where UI exposes | **Yes** (in-app) |
| `admin` | Users, audit, integrations, settings, pilot hub, configuration snapshot | **Yes** (in-app) |
| `readonly_auditor` | Read-heavy; **cannot** create incidents per API | **No** — Cognito outside UI |
| `analyst` | Placeholder / future workflows | **No** — Cognito outside UI |
| `platform_superadmin` | Cross-agency platform tools | **No** — internal only |

## API vs UI alignment

- Routes under `/api/admin/*` and `/api/integration/status` require **admin** or **platform_superadmin** per [API_SURFACE.md](./API_SURFACE.md).
- Dispatchers receive **403** on integration status — by design.

## Agency vs platform

- **Agency admin** sees only users with their `agencyId` in the directory list; cannot set another agency on create.
- **Platform superadmin** sees all users in the pool (up to service limit) and may set agency on create.

## Changing roles after hire

Use **Save** on the user row. Cognito eventually consistent; list refreshes after success. If a user must be **downgraded urgently**, deactivate first, then re-provision or re-enable via Cognito with correct attributes per agency policy.

## Related

- [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)
- [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)
