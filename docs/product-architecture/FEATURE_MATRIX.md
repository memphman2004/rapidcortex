# Feature matrix — maturity at a glance

**Legend**

| Maturity | Meaning |
|----------|---------|
| **Live in pilot** | In the baseline pilot product when stack + standard web env are correctly set. |
| **Pilot-limited** | Shipped; intentionally constrained UI or backend (honest partials). |
| **Admin-configured** | Requires deliberate env/secrets/tables or agency policy inputs—not “on” by default everywhere. |
| **Future / not included** | Not a first-agency pilot promise; may appear as roadmap, adapter interfaces, or placeholders. |

If this matrix conflicts with **[MVP_SCOPE.md](./MVP_SCOPE.md)** or **[NON_GOALS.md](./NON_GOALS.md)**, defer to those documents.

## Core product

| Capability | Maturity | Notes |
|------------|----------|-------|
| Cognito sign-in / refresh (cookie proxy pattern) | **Live in pilot** | [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md) |
| Agency isolation on API (`custom:agencyId`) | **Live in pilot** | Slug is branding; JWT is boundary ([USER_GUIDE.md](./USER_GUIDE.md)). |
| Dispatcher dashboard (queue, detail, transcript, intelligence) | **Live in pilot** | Requires configured API ([CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md)). |
| Incident create / list / get | **Live in pilot** | Via API / UI flows as implemented. |
| Transcript append / list | **Live in pilot** | |
| Manual / debounced AI analysis | **Live in pilot** | Provider chain **admin-configured** on Lambdas ([AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md)). |
| Protocol packs / coaching | **Live in pilot** | Pack selection and governance **admin-configured** / agency-approved ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)). |
| History / review routes | **Live in pilot** | As implemented per [CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md). |
| Admin users / audit / integrations / settings | **Live in pilot** | Integrations panel reflects backend config issues. |
| Admin **Pilot hub** (`/admin/pilot`) | **Live in pilot** | Doc links + local onboarding trackers (browser-only persistence). |
| Admin **Configuration** (`/admin/configuration`) | **Live in pilot** | Read-only `NEXT_PUBLIC_*` + client flags + embedded integration status (not remote-config). |
| `/demo` scenarios + demo API | **Live in pilot** | **Isolated** from live ops default ([NON_GOALS.md](./NON_GOALS.md) §5). |
| Dashboard scripted transcript chunk player | **Pilot-limited** | Off by default when API live; opt-in env ([NON_GOALS.md](./NON_GOALS.md) §5). |
| Offline mock incident queue | **Pilot-limited** | `NEXT_PUBLIC_OFFLINE_DEMO_MODE=1` only—**not** default pilot ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)). |
| Audit events for mutations / sensitive reads | **Live in pilot** | Coverage per [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md). |

## Integrations & data feeds

| Capability | Maturity | Notes |
|------------|----------|-------|
| Incident creation without CAD connector | **Live in pilot** | API / product flows. |
| Bidirectional CAD / RMS | **Future / not included** | Vendor project ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)). |
| Live radio / telephony ingest (universal) | **Future / not included** | Adapter + ops project; multilingual chunks **admin-configured** ([MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md)). |
| Webhook ingress (CAD events) | **Future / not included** | Admin **Integrations** shows roadmap placeholder (`WebhookEventIngressPlaceholder`). |

## Commercial / platform

| Capability | Maturity | Notes |
|------------|----------|-------|
| Agency billing profile / plan UI | **Pilot-limited** | Square OAuth / full sync **not** pilot-default promise ([NON_GOALS.md](./NON_GOALS.md), billing pages). |
| Platform agency CRUD | **Admin-configured** | `platform_superadmin` + deployment choice ([API_SURFACE.md](./API_SURFACE.md)). |

## AI / voice

| Capability | Maturity | Notes |
|------------|----------|-------|
| Structured AI output (Zod / schema-bound) | **Live in pilot** | |
| Mock-only AI in prod-like stages | **Pilot-limited** | Escape hatch only; policy decision ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)). |
| Multilingual pipeline | **Admin-configured** | Secrets + tables + strict mode ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)). |

## Related

- [PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md)
- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)
- [DEMO_DEBT_INVENTORY.md](./DEMO_DEBT_INVENTORY.md)
