# Rapid Cortex

**Real-time AI intelligence for emergency response** — a browser-based AWS SaaS co-pilot for dispatchers, with supervisor and admin workflows, protocol-backed guidance, and CJIS-aligned patterns (not a compliance claim).

## Monorepo layout

| Path | Description |
|------|-------------|
| [`apps/web`](./apps/web) | Next.js dispatcher UI + BFF auth; **production:** **Amazon ECS on Fargate** (SSR container) + ALB + **CloudFront**; image from [`Dockerfile.ssr-web`](./Dockerfile.ssr-web) via **ECR** (build in CI—no Docker required on developer machines); URLs like **`https://www.rapidcortex.us/<jurisdiction-slug>/…`** |
| [`apps/api`](./apps/api) | Node + TypeScript Lambda handlers, Dynamo repositories, AI providers |
| [`packages/shared`](./packages/shared) | Shared types, Zod schemas, protocol engine |
| [`packages/protocols`](./packages/protocols) | Protocol catalog surface (versioned path to agency packs) |
| [`packages/integrations`](./packages/integrations) | Audio / CAD / event adapter interfaces |
| [`packages/security`](./packages/security) | RBAC helpers and audit action constants |
| [`docs`](./docs) | Operator + pilot docs; **canonical scope:** [`docs/MVP_SCOPE.md`](./docs/MVP_SCOPE.md), [`docs/NON_GOALS.md`](./docs/NON_GOALS.md) |
| [`docs/phase-0`](./docs/phase-0) | Product framing (one-pager, build order, risks, brand/UI); scope/non-goals defer to parent `docs/` |
| [`docs/phase-1`](./docs/phase-1) | Repository / foundation exit criteria |
| [`infra`](./infra) | AWS IaC: SAM **`template.yaml`** (Lambda HTTP API, DynamoDB, Cognito, etc.); SSR web **`web-ssr-fargate-template.yaml`** (ECS Fargate, ALB, CloudFront, ECR) |
| [`demo`](./demo) | Pilot/sales demo assets (non-secret) |

## Production: 100% AWS native

Production runs **entirely on AWS**—no third-party app host as the system of record.

- **API & workers:** AWS Lambda + **API Gateway HTTP API**, **Amazon DynamoDB**, **Amazon Cognito**, and related services declared in [`infra/template.yaml`](./infra/template.yaml) (deploy via SAM; see [`docs/deployment-infrastructure/DEPLOYMENT.md`](./docs/deployment-infrastructure/DEPLOYMENT.md), [`package.json`](./package.json) scripts `deploy:api`, `sam:validate`).
- **Web (Next.js):** **Amazon ECS on Fargate** runs the SSR workload (replacing a self-managed Docker host: AWS runs the tasks, scaling, and platform). You ship an **OCI image** to **ECR** ([`Dockerfile.ssr-web`](./Dockerfile.ssr-web)); CI or operators use [`scripts/push-web-ssr-image.sh`](./scripts/push-web-ssr-image.sh), stack updates with [`scripts/deploy-web-ssr.sh`](./scripts/deploy-web-ssr.sh) (`npm run deploy:web:ssr` / `npm run docker:push:ssr`). CI/CD is **not** checked into this repo—see [`docs/deployment-infrastructure/CI_RELEASE_PIPELINE.md`](./docs/deployment-infrastructure/CI_RELEASE_PIPELINE.md).

Local `npm run dev:web` is for development only; **www.rapidcortex.us** in production should resolve to the CloudFront / ALB fronting your ECS service once the stack and image are applied.

## Prerequisites

- **Node.js 22+** (LTS recommended)
- **npm** 10+

## Setup

```bash
npm install
cp .env.example apps/web/.env.local   # then fill values for your environment
```

## Scripts (run from repo root)

| Script | Purpose |
|--------|---------|
| `npm run build` | Builds all workspaces in dependency order |
| `npm run dev:web` | Next.js dev server (`apps/web`) |
| `npm run dev` | API TypeScript watch (`apps/api`) |
| `npm run lint:web` | ESLint for `apps/web` |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (CI) |
| `npm run seed:superadmin` | Create or update the first **platform** Cognito super admin (see [docs/CREATE_FIRST_SUPER_ADMIN.md](./docs/CREATE_FIRST_SUPER_ADMIN.md)) |
| `npm run seed:role-test-users` | Create/update **five** role-based QA accounts (see [docs/SEED_ROLE_TEST_ACCOUNTS.md](./docs/SEED_ROLE_TEST_ACCOUNTS.md)) |
| `npm run typecheck` | Build shared + security packages, then `tsc --noEmit` for `apps/web` |
| `npm run deploy:api` | SAM backend deploy (`scripts/deploy.sh`) |
| `npm run deploy:web:ssr` | Deploy / update ECS Fargate SSR stack (`scripts/deploy-web-ssr.sh`) |
| `npm run docker:push:ssr` | Build and push web container image to ECR (`scripts/push-web-ssr-image.sh`) |

## Operator documentation

| Document | Audience |
|----------|----------|
| [docs/MVP_SCOPE.md](./docs/MVP_SCOPE.md) | Pilot scope, story, roles, assistive AI (canonical) |
| [docs/NON_GOALS.md](./docs/NON_GOALS.md) | Explicit exclusions for MVP and first-agency pilot |
| [docs/GTM_PACKAGE.md](./docs/GTM_PACKAGE.md) | Sales, onboarding, training, support — operational GTM entry |
| [docs/JURISDICTION_OPERATIONS_GUIDE.md](./docs/JURISDICTION_OPERATIONS_GUIDE.md) | **County / city / municipality:** install-on-screen, setup, maintenance, troubleshooting + **download bundle** manifest |
| [docs/SALES_SCOPE_MATRIX.md](./docs/SALES_SCOPE_MATRIX.md) | Promise vs out-of-scope matrix for pilots |
| [docs/PRODUCT_OVERVIEW.md](./docs/PRODUCT_OVERVIEW.md) | Sales- / buyer-safe product summary (defers to MVP_SCOPE) |
| [docs/PILOT_OVERVIEW.md](./docs/PILOT_OVERVIEW.md) | First-agency pilot lens |
| [docs/IDEAL_CUSTOMER_PROFILE.md](./docs/IDEAL_CUSTOMER_PROFILE.md) | Pilot ICP / fit filter |
| [docs/USE_CASES.md](./docs/USE_CASES.md) | Primary pilot use cases |
| [docs/FEATURE_MATRIX.md](./docs/FEATURE_MATRIX.md) | Feature maturity (live / limited / configured / future) |
| [docs/PILOT_VS_FUTURE_STATE.md](./docs/PILOT_VS_FUTURE_STATE.md) | Pilot box vs roadmap |
| [docs/IMPLEMENTATION_ASSUMPTIONS.md](./docs/IMPLEMENTATION_ASSUMPTIONS.md) | Default deployment assumptions |
| [docs/AGENCY_ONBOARDING_RUNBOOK.md](./docs/AGENCY_ONBOARDING_RUNBOOK.md) | Signed pilot → first use |
| [docs/AGENCY_SETUP_CHECKLIST.md](./docs/AGENCY_SETUP_CHECKLIST.md) | Agency + RC setup checklist |
| [docs/PILOT_KICKOFF_CHECKLIST.md](./docs/PILOT_KICKOFF_CHECKLIST.md) | Kickoff meeting checklist |
| [docs/IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./docs/IMPLEMENTATION_WORKBOOK_TEMPLATE.md) | Per-agency implementation workbook (copy) |
| [docs/PILOT_SUCCESS_AND_FEEDBACK.md](./docs/PILOT_SUCCESS_AND_FEEDBACK.md) | Pilot metrics and feedback loop |
| [docs/TRAINING_DISPATCHER.md](./docs/TRAINING_DISPATCHER.md) | Dispatcher training (live UI paths) |
| [docs/TRAINING_SUPERVISOR.md](./docs/TRAINING_SUPERVISOR.md) | Supervisor training |
| [docs/TRAINING_ADMIN.md](./docs/TRAINING_ADMIN.md) | Agency admin training |
| [docs/QUICKSTART_CARD.md](./docs/QUICKSTART_CARD.md) | One-page rollout quickstart |
| [docs/FIRST_DAY_CHECKLIST.md](./docs/FIRST_DAY_CHECKLIST.md) | First-day pilot checklist |
| [docs/COMMON_TASKS.md](./docs/COMMON_TASKS.md) | Step-by-step common tasks |
| [docs/ESCALATION_PATHS.md](./docs/ESCALATION_PATHS.md) | Severity and escalation order |
| [docs/OPS_CONTACT_MATRIX.md](./docs/OPS_CONTACT_MATRIX.md) | Ops contact template (fill per pilot) |
| [docs/TROUBLESHOOTING_GUIDE.md](./docs/TROUBLESHOOTING_GUIDE.md) | Evidence and symptom routing |
| [docs/ADMIN_SETUP_GUIDE.md](./docs/ADMIN_SETUP_GUIDE.md) | Admin hub setup and honest UI boundaries |
| [docs/USER_PROVISIONING_GUIDE.md](./docs/USER_PROVISIONING_GUIDE.md) | Create / update / deactivate users |
| [docs/ROLE_MAPPING_GUIDE.md](./docs/ROLE_MAPPING_GUIDE.md) | Cognito roles vs product access |
| [docs/CONFIGURATION_REFERENCE.md](./docs/CONFIGURATION_REFERENCE.md) | Configuration classes and ownership |
| [docs/PILOT_CONFIGURATION_MODEL.md](./docs/PILOT_CONFIGURATION_MODEL.md) | Where settings live (global/env/agency/role) |
| [docs/FEATURE_FLAGS.md](./docs/FEATURE_FLAGS.md) | Web vs Lambda toggles |
| [docs/AGENCY_CONFIGURATION_GUIDE.md](./docs/AGENCY_CONFIGURATION_GUIDE.md) | Agency vs internal ops |
| [docs/ENVIRONMENT_CONFIGURATION_REFERENCE.md](./docs/ENVIRONMENT_CONFIGURATION_REFERENCE.md) | Long-form env listing |
| [docs/PILOT_READINESS_CHECKLIST.md](./docs/PILOT_READINESS_CHECKLIST.md) | Pre-launch governance + technical checklist |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | Dispatchers, supervisors, admins |
| [docs/INSTALLATION.md](./docs/INSTALLATION.md) | Engineers installing dev or AWS environments |
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | On-call / DevOps / platform operations |
| [docs/deployment-infrastructure/DEPLOYMENT.md](./docs/deployment-infrastructure/DEPLOYMENT.md) | Repeatable SAM deploy, CORS, domains, secrets |
| [docs/ENVIRONMENT_MATRIX.md](./docs/ENVIRONMENT_MATRIX.md) | dev / staging / prod / pilot vs web env vars |
| [docs/AUTH_OPERATIONS.md](./docs/AUTH_OPERATIONS.md) | Cognito flows, RBAC, refresh, unsupported cases |
| [docs/API_SURFACE.md](./docs/API_SURFACE.md) | HTTP API inventory (RBAC, audit, auth modes) |
| [docs/CORE_USER_FLOWS.md](./docs/CORE_USER_FLOWS.md) | Pilot UI ↔ API wiring; mock vs live |
| [docs/SECURITY_MODEL.md](./docs/SECURITY_MODEL.md) | Pilot technical security boundaries (not certification) |
| [docs/AUDIT_EVENT_MATRIX.md](./docs/AUDIT_EVENT_MATRIX.md) | Audit `type` vocabulary and UI notes |
| [docs/INTEGRATIONS_CAD_AND_MOTOROLA.md](./docs/INTEGRATIONS_CAD_AND_MOTOROLA.md) | CAD integration planning (e.g. Motorola-class deployments) |

## Product direction (locked)

See **[docs/MVP_SCOPE.md](./docs/MVP_SCOPE.md)** and **[docs/NON_GOALS.md](./docs/NON_GOALS.md)** for pilot-aligned scope and boundaries. Narrative, metrics, and engineering build order remain in **[docs/phase-0](./docs/phase-0/README.md)** (one-pager, `mvp-features.md`, architecture principles, brand/UI, risk register).

## Delivery phases (engineering)

| Phase | Doc |
|-------|-----|
| 2 — Dashboard UI (mock/live demo) | [docs/phase-2/README.md](./docs/phase-2/README.md) |
| 3 — Backend core (API + Dynamo) | [docs/phase-3/README.md](./docs/phase-3/README.md) |
| 4 — Auth + tenant scoping | [docs/phase-4/README.md](./docs/phase-4/README.md) |
| 5 — AI provider architecture | [docs/phase-5/README.md](./docs/phase-5/README.md) |
| 6 — Protocol engine | [docs/phase-6/README.md](./docs/phase-6/README.md) |
| 7 — Transcript streaming | [docs/phase-7/README.md](./docs/phase-7/README.md) |

## Phase 1 exit criteria

- Workspace packages compile and **import from `apps/web`** (see `apps/web/lib/phase1-workspace.ts`).
- `npm run build` completes for **shared → protocols → integrations → security → api → web**.

## License

Private — All rights reserved unless otherwise stated.
