# Architecture principles

## 1. Modular monorepo

- **`apps/web`** — Next.js UI, BFF routes, Cognito session bridging.
- **`apps/api`** — AWS Lambda + API Gateway handlers, services, repositories.
- **`packages/shared`** — Types, Zod schemas, protocol engine shared with API and web.
- **`packages/protocols`** — Versioned protocol pack surface (JSON/build), agency-ready path.
- **`packages/integrations`** — Vendor-agnostic adapters (audio, CAD, events).
- **`packages/security`** — RBAC helpers, audit/redaction utilities, policy types.
- **`infra`** — SAM / IaC, env matrices, GovCloud migration notes.
- **`docs`**, **`demo`** — Product truth and repeatable demo assets.

## 2. AWS-native, cost-aware

- Lambda + DynamoDB + S3 + Cognito as default path.
- **Pay-per-use** friendly; avoid always-on heavy services in MVP unless justified.

## 3. Security by default

- **Least privilege** IAM; secrets in **Secrets Manager / SSM**, not code.
- **Tenant isolation**: every incident/transcript/analysis query checks **agencyId**.
- **Audit** on security- and workflow-sensitive actions.

## 4. Contract-first APIs

- Request/response shapes validated with **Zod** at boundaries where feasible.
- Shared **TypeScript** models in `packages/shared` to prevent UI/API drift.

## 5. Protocol engine ≠ LLM

- **Protocol engine** selects steps and **approved phrases**.
- **LLM** classifies and narrates within schema; optional “humanize” must **not add facts**.

## 6. Demo and production parity

- **Same code paths** for demo and live where possible; feature flags for mock providers and simulated streams.

## 7. Observability

- Structured **JSON logs**; correlation ids per request/incident where practical.

## 8. Evolution to GovCloud

- **Environment separation** (dev / staging / prod) and **config loader** patterns documented for future GovCloud landing.
