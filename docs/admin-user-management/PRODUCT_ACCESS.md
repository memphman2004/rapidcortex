# Product access model

**Rapid Cortex** is the full public safety web platform (dispatcher, supervisor, agency admin, QA/training, IT/security, responder, executive, platform superadmin workspaces).

**RC Lite** is an API-only product sold separately. It exposes tenant-scoped OAuth clients, REST endpoints, webhooks, metering, and audit-facing surfaces through the RC Lite portal—not the operational Rapid Cortex dashboards.

**API Access Add-On** layers API + webhook entitlements onto an existing Rapid Cortex Command or Enterprise subscription without requiring the standalone RC Lite SKU.

Entitlement resolution runs in `rapid-cortex-shared` (`monetization/entitlements.ts` + `auth/session-product.ts`) using Cognito claims such as `custom:customerType`, `custom:planId`, and `custom:entitlements`.

RC Lite’s Dynamo/seed plan uses **only** `RC_LITE_API_ONLY_FEATURES` (API keys like `incident_api`, `cad_export_api`, `api_portal_access`, …) and never grants `dashboard_access` or `*_dashboard` role surfaces. Full platform plans include `dashboard_access` plus dispatcher/supervisor/admin feature flags; CAD **console** workflows use `cad_export`, while RC Lite CAD integration uses **`cad_export_api`** without unlocking in-app CAD workflows.

Path-level product gates for tests and middleware alignment live in `auth/route-gate.ts` (`sessionPassesProductGateForPath`).

## RC Lite HTTPS surface (`/api/v1`)

Route registry + metering stubs live under `packages/shared/src/rc-lite/v1-registry.ts` and `apps/web/lib/rc-lite/*`. Provisioned deployments should proxy to upstream workers or call AWS Lambda equivalents; hashed API keys persist through a dedicated Dynamo table (planned).

OpenAPI scaffold: [`openapi/rc-lite-v1.openapi.yaml`](./openapi/rc-lite-v1.openapi.yaml).

