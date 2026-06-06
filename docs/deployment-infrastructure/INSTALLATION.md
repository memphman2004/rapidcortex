# Rapid Cortex — Installation guide

This document covers **local development** and **AWS deployment** of the monorepo: web app (`apps/web`), API (`apps/api` + SAM), and shared packages.

## Prerequisites

| Tool            | Version / notes                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**     | 22+ LTS recommended (root `README.md` specifies 22+)                                                                                                     |
| **npm**         | 10+                                                                                                                                                      |
| **AWS CLI**     | Configured profile with rights to deploy the stack (see [`infra/iam/sam-deploy-policy.json`](../infra/iam/sam-deploy-policy.json) as a starting policy). |
| **AWS SAM CLI** | For `sam build` / `sam deploy` / `sam validate`                                                                                                          |
| **Docker**      | Required only if you use `sam local start-api` or similar local API emulation                                                                            |

## 1. Clone and install

```bash
git clone <repository-url>
cd "Rapid Cortex"   # or your checkout directory name
npm install
```

## 2. Environment files

Copy the root template and customize for the web app:

```bash
cp .env.example apps/web/.env.local
```

Edit `apps/web/.env.local` for your environment.

**Production URL shape:** the marketing site lives at the site root (`/`, `/pricing`, `/signup`). The signed-in product is at **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`** (dashboard, login, admin, etc.). Set `NEXT_PUBLIC_SITE_URL` to `https://www.rapidcortex.us` and set `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` to the primary pilot slug used in sign-in links and “Open app” CTAs. If unset, the app falls back to **`example-city`** (a neutral placeholder, not a tenant — always override in real deployments).

Important variables:

| Variable                                        | Purpose                                                                                                                                                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                          | Canonical site URL (e.g. `https://www.rapidcortex.us` in production).                                                                                                                                                                   |
| `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG`         | Default jurisdiction slug for product links from the marketing site (sign-in, “Open app”); e.g. `columbus` or `franklin-county`.                                                                                                        |
| `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM` | Set to `1` to show scripted transcript chunk controls on **`/dashboard`** when the API is live. Omit on pilot hosts that should default to real traffic only; use **`/demo`** for academy playback ([NON_GOALS.md](./NON_GOALS.md) §5). |
| `NEXT_PUBLIC_DOCUMENTATION_BASE_URL`            | Optional. Absolute URL prefix to the hosted **`docs/`** tree (e.g. `https://docs.yourorg.example/rapid-cortex/`) so **Admin → Pilot hub** and the marketing site can open markdown articles in a new tab.                           |
| `NEXT_PUBLIC_API_BASE`                          | Full URL of the HTTP API (no trailing slash), **if** the browser calls the API directly with bearer tokens from the client.                                                                                                             |
| `NEXT_PUBLIC_AUTH_PROXY`                        | Set to `1` to use the **Next.js BFF** at `/api/backend/*` so the browser sends cookies instead of exposing tokens to JavaScript.                                                                                                        |
| `API_UPSTREAM_BASE`                             | **Server-only**: when using the auth proxy, the absolute URL of the SAM API (e.g. `https://xxxx.execute-api.us-east-1.amazonaws.com`).                                                                                                  |

Cognito-related variables for the Next auth routes (`COGNITO_CLIENT_ID`, `COGNITO_ISSUER`, etc.) must match the **same user pool** configured on the API authorizer. Align values with CloudFormation **stack outputs** after deploy (`UserPoolId`, `UserPoolClientId`, issuer URL pattern in runbook). Self-service **`/signup`** and the PostConfirmation trigger are documented in **[COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md)**.

The API’s DynamoDB and AI variables are injected by **SAM** (`infra/template.yaml` `Globals.Function.Environment`); you normally do **not** hand-edit those in Lambda except for secrets (prefer AWS Secrets Manager / SSM for production).

## 3. Build the monorepo

```bash
npm run build
```

This builds workspaces in dependency order (`shared` → `protocols` → `integrations` → `security` → `api` → `web`).

## 4. Local development

### Web only

```bash
npm run dev:web
```

Default Next dev port is **3000**; use another if occupied (`npx next dev -p 3001`).

### API TypeScript watch (optional)

```bash
npm run dev
```

Compiles `apps/api` with `tsc -w`.

### Full stack (API on AWS or local SAM)

1. Deploy or run the API so you have a base URL.
2. Point `NEXT_PUBLIC_API_BASE` **or** `API_UPSTREAM_BASE` + `NEXT_PUBLIC_AUTH_PROXY=1` at that URL.
3. Run `npm run dev:web`.

**Local SAM API** (optional):

```bash
sam build --template-file infra/template.yaml
sam local start-api --template-file .aws-sam/build/template.yaml
```

Requires Docker. See SAM docs for port and host flags.

## 5. AWS deployment (API + data plane)

End-to-end checklist: **[AWS_SETUP.md](./AWS_SETUP.md)**. Stage isolation, CORS gate, and migration notes: **[DEPLOYMENT.md](./DEPLOYMENT.md)** / **[ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)**.

**Prepare and validate locally** (install, build, Cognito trigger deps, `sam validate`):

```bash
chmod +x scripts/aws-setup.sh scripts/deploy.sh scripts/post-deploy-smoke.sh scripts/print-stack-outputs-for-web.sh
./scripts/aws-setup.sh
# or: npm run aws:setup
```

**Deploy** the API + data plane (after a successful build):

```bash
./scripts/deploy.sh dev
```

Stages: `dev`, `staging`, `prod`, `pilot` → stacks `rapid-cortex-<stage>`.

Optional environment variables for the deploy script (see `infra/README.md`):

- `ROOT_DOMAIN`, `API_SUBDOMAIN_PREFIX`
- `API_DOMAIN_CERT_ARN` or `ROUTE53_HOSTED_ZONE_ID` (managed ACM)
- `APP_CNAME_TARGET`, `ADMIN_CNAME_TARGET`, `WWW_CNAME_TARGET`
- **`HTTP_API_CORS_ORIGINS`** — required for **`staging`**, **`prod`**, and **`pilot`** (comma-separated `https://` origins; no spaces). Use `SKIP_CORS_CHECK=1` only if you intentionally accept misconfigured CORS.

Post-deploy:

```bash
./scripts/post-deploy-smoke.sh dev us-east-1
```

**Suggested `apps/web` env block** from CloudFormation:

```bash
./scripts/print-stack-outputs-for-web.sh dev us-east-1
# or: npm run aws:print-web-env -- dev us-east-1
```

Collect outputs manually if needed: `HttpApiUrl`, `UserPoolId`, `UserPoolClientId`, `ApiCustomDomainUrl` (if set), `AssetsBucketName`, `SelfSignupDefaultAgencyIdValue`, `CognitoIssuer`.

## 6. Web deployment

The repository does **not** pin a single host for Next.js. Typical options:

- **Vercel / Netlify / Amplify** — connect the repo; set environment variables in the host UI.
- **Container** — build `apps/web` with `next build` and run `next start` behind your load balancer; inject the same env vars.

Ensure **HTTPS** in production and restrict **CORS** on the API when you move off `AllowOrigins: *` (see `infra/template.yaml`).

## 7. First-time agency onboarding (checklist)

**County / city / municipality field guide (operators + IT):** [JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md) — includes a **download package** file list for agency binders or secure ZIPs.

1. **Cognito** user pool and app client are created by the **SAM stack** (outputs drive the web app’s `NEXT_PUBLIC_COGNITO_*` values).
2. Deploy the SAM stack for the target **stage** (see [AWS_SETUP.md](./AWS_SETUP.md)).
3. Create **agency** row (admin API or seed script per your process).
4. Invite users with correct **`custom:agencyId`** and **`custom:role`**.
5. Smoke-test **health**, **sign-in**, **list incidents**, **audit** (see [RUNBOOK.md](./RUNBOOK.md)).

## 8. Verification commands

```bash
npm run format:check
npm run lint:web
sam validate --lint --template-file infra/template.yaml
```

## CAD Integration

CAD integration requires agency/vendor-specific discovery and is **not** a one-click setup in this repository.

- Start with the operational playbook: [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md)
- Vendor-specific framing and scope boundaries: [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)
- For pilots, prefer no-CAD or read-only/shadow mode first, then move to assisted write-back only after sandbox validation and written approval.

## Related documents

- [AWS_SETUP.md](./AWS_SETUP.md) — full AWS path (scripts, deploy, smoke, web env from stack).
- [RUNBOOK.md](./RUNBOOK.md) — day-2 operations.
- [USER_GUIDE.md](./USER_GUIDE.md) — end-user flows.
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — admin and platform workflows.
- [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md) — short trainer outline.
- [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) — support routing.
- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) — pilot scope boundaries.
- [DEMO_DEBT_INVENTORY.md](./DEMO_DEBT_INVENTORY.md) — demo-oriented surfaces vs pilot defaults.
- [GTM_PACKAGE.md](./GTM_PACKAGE.md) — go-to-market, onboarding, training, and support package.
- [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md) — agency onboarding from signature to first use.
- [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) — admin UI setup; [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md) — full env listing.
- [`infra/README.md`](../infra/README.md) — domain, ACM, IAM policy artifacts.
- [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md) — connecting to CAD vendors.
- [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md) — strict CAD rollout steps for pilot/production.

**Local-only mock incidents:** set `NEXT_PUBLIC_OFFLINE_DEMO_MODE=1` in `.env.local` if you want the legacy in-browser incident queue **without** wiring `API_UPSTREAM_BASE` / `NEXT_PUBLIC_API_BASE`. Leave it **unset** on staging/pilot/production.
