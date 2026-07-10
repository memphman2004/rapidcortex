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
| [`docs`](./docs) | Operator + pilot docs — **start at** [`docs/INDEX.md`](./docs/INDEX.md); canonical scope: [`docs/go-to-market-sales/MVP_SCOPE.md`](./docs/go-to-market-sales/MVP_SCOPE.md), [`docs/go-to-market-sales/NON_GOALS.md`](./docs/go-to-market-sales/NON_GOALS.md) |
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
| `npm run seed:superadmin` | Create or update the first **platform** Cognito super admin (see [docs/admin-user-management/CREATE_FIRST_SUPER_ADMIN.md](./docs/admin-user-management/CREATE_FIRST_SUPER_ADMIN.md)) |
| `npm run seed:role-test-users` | Create/update **five** role-based QA accounts (see [docs/admin-user-management/SEED_ROLE_TEST_ACCOUNTS.md](./docs/admin-user-management/SEED_ROLE_TEST_ACCOUNTS.md)) |
| `npm run typecheck` | Build shared + security packages, then `tsc --noEmit` for `apps/web` |
| `npm run deploy:api` | SAM backend deploy (`scripts/deploy.sh`) |
| `npm run deploy:web:ssr` | Deploy / update ECS Fargate SSR stack (`scripts/deploy-web-ssr.sh`) |
| `npm run docker:push:ssr` | Build and push web container image to ECR (`scripts/push-web-ssr-image.sh`) |

## Operator documentation

**Full index:** [`docs/INDEX.md`](./docs/INDEX.md) — canonical paths for all sales, onboarding, training, deployment, and security docs.

| Document | Audience |
|----------|----------|
| [docs/go-to-market-sales/GTM_PACKAGE.md](./docs/go-to-market-sales/GTM_PACKAGE.md) | Sales, onboarding, training, support — operational GTM entry |
| [docs/go-to-market-sales/GTM_EXECUTION_PLAN.md](./docs/go-to-market-sales/GTM_EXECUTION_PLAN.md) | 90-day pilot-first execution plan |
| [docs/go-to-market-sales/CONTRACT_PACKAGE_INDEX.md](./docs/go-to-market-sales/CONTRACT_PACKAGE_INDEX.md) | What contracts and trust artifacts to send when |
| [docs/go-to-market-sales/DOCUMENT_GAPS.md](./docs/go-to-market-sales/DOCUMENT_GAPS.md) | Missing or draft-only artifact tracker |
| [docs/go-to-market-sales/MVP_SCOPE.md](./docs/go-to-market-sales/MVP_SCOPE.md) | Pilot scope, roles, assistive AI (canonical) |
| [docs/go-to-market-sales/NON_GOALS.md](./docs/go-to-market-sales/NON_GOALS.md) | Explicit exclusions for MVP and first-agency pilot |
| [docs/deployment-infrastructure/PILOT_READINESS_CHECKLIST.md](./docs/deployment-infrastructure/PILOT_READINESS_CHECKLIST.md) | Pre-launch governance + technical checklist |
| [docs/deployment-infrastructure/DEPLOYMENT.md](./docs/deployment-infrastructure/DEPLOYMENT.md) | Repeatable SAM deploy, CORS, domains, secrets |
| [docs/security-compliance/SECURITY_MODEL.md](./docs/security-compliance/SECURITY_MODEL.md) | Pilot technical security boundaries (not certification) |
| [docs/security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md](./docs/security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md) | Draft procurement questionnaire pack |
| [docs/security-compliance/SUBPROCESSOR_LIST.md](./docs/security-compliance/SUBPROCESSOR_LIST.md) | Draft subprocessor list |

## Product direction (locked)

See **[docs/go-to-market-sales/MVP_SCOPE.md](./docs/go-to-market-sales/MVP_SCOPE.md)** and **[docs/go-to-market-sales/NON_GOALS.md](./docs/go-to-market-sales/NON_GOALS.md)** for pilot-aligned scope and boundaries. Narrative, metrics, and engineering build order remain in **[docs/phase-0](./docs/phase-0/README.md)** (one-pager, `mvp-features.md`, architecture principles, brand/UI, risk register).

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
