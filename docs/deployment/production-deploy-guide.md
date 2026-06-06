# Rapid Cortex production deployment — corrected guide

## Context

Deploy Rapid Cortex emergency services to AWS production. Infrastructure uses **AWS SAM** with **nested CloudFormation stacks**. The SAM transformed-template **~1 MB** limit issue is remediated via a **2-nested-stack** split.

## Current state

- **AWS account:** `158961537080`
- **Environment:** Production (`prod`)
- **Domain:** https://www.rapidcortex.us
- **API health (when custom domain is configured):** https://api.rapidcortex.us/api/health  
  _(Confirm exact base URL from CloudFormation outputs **ApiCustomDomainUrl** or **HttpApiUrl** after deploy.)_
- **Template structure:**
  - **Root:** `infra/template.yaml` (~24 KB) — parameters, nested wiring, outputs
  - **Data layer:** `infra/nested/stack-data-layer.yaml` (~68 KB) — DynamoDB, S3, Secrets
  - **App SAM:** `infra/nested/stack-app-sam.yaml` (~188 KB) — HttpApi, Lambdas, Cognito, WAF, monitoring, Trail
- **Validation:** Nested stacks **`sam validate --lint --template-file …`**, **`./scripts/infra-template-size-check.sh`**, and deploy path **`scripts/deploy.sh`** (runs **`sam build`** / **`sam deploy`**). **`sam package`** is optional for packaged artifact size checks.

---

## Pre-deployment checks

### 1. Verify AWS credentials and account

```bash
# Check current AWS credentials
aws sts get-caller-identity

# Expected: Account == 158961537080 (use an admin/deploy-capable principal)

# Deploy script warns (does not abort) if this is set and differs from caller identity:
export EXPECTED_AWS_ACCOUNT_ID=158961537080
```

### 2. Verify environment variables

```bash
export HTTP_API_CORS_ORIGINS=https://www.rapidcortex.us
export EXPECTED_AWS_ACCOUNT_ID=158961537080

echo "$HTTP_API_CORS_ORIGINS"
echo "$EXPECTED_AWS_ACCOUNT_ID"
```

Production deploy rejects wildcard or `http:` / `localhost` patterns in **`HTTP_API_CORS_ORIGINS`** (see **`scripts/deploy.sh`**).

### 3. Run pre-deployment validation

```bash
# From repository root — nested stacks (--lint is authoritative)
sam validate --template-file infra/template.yaml
sam validate --lint --template-file infra/nested/stack-data-layer.yaml
sam validate --lint --template-file infra/nested/stack-app-sam.yaml

# Template sizing (runs sam build; should RESULT: PASS, under ~900 KB fail band per artifact)
./scripts/infra-template-size-check.sh
```

---

## Deployment steps

### STEP 1: Preview infrastructure (change set)

```bash
HTTP_API_CORS_ORIGINS=https://www.rapidcortex.us \
EXPECTED_AWS_ACCOUNT_ID=158961537080 \
./scripts/deploy.sh prod --changeset-only
```

**Review:** creates/updates/deletes, IAM, security groups, and especially **REPLACE** on DynamoDB or S3 (data loss).

**Questions to ask the changeset**

- DynamoDB tables **REPLACED**?
- S3 buckets **REPLACED**?
- IAM policy scope still least-privilege and expected?
- Unexpected resource deletions?

### STEP 2: Deploy infrastructure

```bash
HTTP_API_CORS_ORIGINS=https://www.rapidcortex.us \
EXPECTED_AWS_ACCOUNT_ID=158961537080 \
./scripts/deploy.sh prod
```

**Rough flow**

1. Optional **WARN** if caller account ≠ **`EXPECTED_AWS_ACCOUNT_ID`** (human should stop if wrong profile).
2. **`sam build`** (+ monorepo API build steps inside **`deploy.sh`**), template size gate, **`sam deploy`** with **`CAPABILITY_IAM`**, **`CAPABILITY_NAMED_IAM`**, **`CAPABILITY_AUTO_EXPAND`**, **`--resolve-s3`** for nested uploads.
3. Root stack default name: **`rapid-cortex-prod`** (override with **`STACK_NAME`**).
4. **DataLayerStack** (~5–15 min typical): DynamoDB, S3, billing/multilingual secrets, etc.
5. **AppSamStack** (~10–25 min typical): HttpApi routes, Lambdas, Cognito, optional WAF, alarms dashboards, Trail-related resources wired in app template.
6. Root stack outputs: API URLs, Cognito ids, etc.

**Expected total:** often **15–40 minutes** (varies by change set size and propagation).

**Monitor**

```bash
aws cloudformation describe-stack-events \
  --stack-name rapid-cortex-prod \
  --max-items 20 \
  --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table
```

Console: https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks

_(Use **`AWS_REGION`** if your stack is not in **`us-east-1`**.)_

### STEP 3: Verify infrastructure deployment

```bash
aws cloudformation describe-stacks \
  --stack-name rapid-cortex-prod \
  --query 'Stacks[0].StackStatus'

# CREATE_COMPLETE | UPDATE_COMPLETE

aws cloudformation describe-stacks \
  --stack-name rapid-cortex-prod \
  --query 'Stacks[0].Outputs' \
  --output table
```

**Key output keys (authoritative)**

| Output | Notes |
|--------|------|
| **HttpApiUrl** | `$default` execute URL-style base |
| **ApiCustomDomainUrl** | e.g. `https://api.rapidcortex.us` when DNS + ACM configured |
| **UserPoolId** | _Not_ `CognitoUserPoolId` |
| **UserPoolClientId** | _Not_ `CognitoClientId` |
| **NativeUserPoolClientId** | Native/desktop client |
| **CognitoIssuer** | JWT issuer |
| **ApiWebAclArn** | When WAF enabled |
| **AssetsBucketName**, **DeploymentStage** | Downstream wiring |

---

### STEP 4: Deploy web SSR (two-part process)

`deploy-web-ssr.sh` deploys **CloudFormation only**. **`push-web-ssr-image.sh`** builds **`Dockerfile.ssr-web`** at the **repo root** and pushes to ECR.

#### Part A — SSR infrastructure (**required env**, then deploy)

Export values from STEP 3 (and your network/certs):

```bash
export VPC_ID=...
export PRIVATE_SUBNET_IDS=...    # comma-separated
export PUBLIC_SUBNET_IDS=...      # comma-separated
export ROUTE53_HOSTED_ZONE_ID=...
export CLOUDFRONT_CERT_ARN=...    # ACM in us-east-1 (CloudFront viewer)
export ALB_CERT_ARN=...           # ACM in workload region (ALB)
export API_BASE_URL=https://api.rapidcortex.us   # or HttpApiUrl
export COGNITO_USER_POOL_ID=<UserPoolId output>
export COGNITO_CLIENT_ID=<UserPoolClientId output>

./scripts/deploy-web-ssr.sh
```

- **SSR stack name (default):** **`rapid-cortex-web-ssr-prod`**
- **ECS cluster / service names (defaults):** **`rapid-cortex-web-prod`** (cluster and service both use this name pattern from **`infra/web-ssr-infra-template.yaml`**).

**Naming trap:** the root API SAM stack is **`rapid-cortex-prod`**. The **ECS cluster is not** that name — use **`rapid-cortex-web-prod`** for `aws ecs describe-services`, `list-tasks`, etc.

Bootstrap order is environment-specific; often **Part A once** creates ECR (unless **`EcrRepositoryOverride`** set), **Part B push**, then **ECS service stabilization** pulls **`latest`** (or force redeploy task definition revision if needed).

#### Part B — Build and push Docker image

Default ECR repository name created by stack is **`rapid-cortex-web-prod`** (`AppName` **`rapid-cortex`**, **`DeploymentStage`** **`prod`**). Align **`ECR_REPOSITORY_NAME`** if you override.

```bash
ECR_REPOSITORY_NAME=rapid-cortex-web-prod ./scripts/push-web-ssr-image.sh
```

**Monitor ECS**

```bash
aws ecs describe-clusters --clusters rapid-cortex-web-prod

aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --query 'services[0].deployments'
```

#### Part C — Ship web **without local Docker** (CodeBuild → ECR → ECS)

Use this when the **web pipeline stack** and **CodeBuild project** already exist (created with the SSR/pipeline infra). The script zips the repo → uploads to the pipeline S3 bucket → starts CodeBuild (image build + push in AWS) → forces an ECS deployment → optional CloudFront invalidation → **`scripts/smoke-web.sh`**.

```bash
cd "/path/to/Rapid Cortex" && ./scripts/deploy-web-no-docker.sh prod
```

**Prerequisites:** ECR repo **`rapid-cortex-web-prod`**, CodeBuild **`rapid-cortex-web-build-prod`**, pipeline stack **`rapid-cortex-web-pipeline-prod`** (defaults for `prod` in **`us-east-1`**; override with env vars below if yours differ).

**Useful env overrides** (see script header in **`scripts/deploy-web-no-docker.sh`** for the full list):

| Variable | Default (`prod`) | Purpose |
|----------|------------------|---------|
| **`ECS_CLUSTER_NAME`** / **`ECS_SERVICE_NAME`** | **`rapid-cortex-web-prod`** | ECS wait + force deploy |
| **`ECS_WAIT_MINUTES`** | **`35`** | Polls **`describe-services`** until **`runningCount == desiredCount`** and **`pendingCount == 0`** (or timeout). **AWS_MAX_ATTEMPTS** does not extend **`aws ecs wait services-stable`** waiter polls (that waiter is ~40×15s internally). |
| **`ECS_STABILITY_POLL_SECONDS`** | **`20`** | Sleep between polls |
| **`ECS_DEPLOY_FAILED_TASKS_ABORT`** | **`8`** | Exit early if the **PRIMARY** deployment’s **`failedTasks`** reaches this (crash loop / failed health checks) |
| **`SKIP_CLOUDFRONT_INVALIDATION`** | unset | Set to **`1`** to skip invalidation |
| **`SKIP_SMOKE`** | unset | Set to **`1`** to skip **`smoke-web.sh`** |

---

### STEP 5: Post-deployment verification

**API health** (SAM route is **`/api/health`**, not **`/health`**):

```bash
curl -fsS "https://api.rapidcortex.us/api/health"
# Expect JSON with a healthy status (exact body may vary slightly)
```

**CORS OPTIONS** — use a path the API exposes (**/api/health** is reliable):

```bash
curl -sI -X OPTIONS "https://api.rapidcortex.us/api/health" \
  -H "Origin: https://www.rapidcortex.us" \
  -H "Access-Control-Request-Method: GET"
# Expect ACAO reflecting your allow-list for credentialed/browser flows where applicable
```

**Web**

```bash
curl -sI https://www.rapidcortex.us
```

**Smoke tests**

```bash
npm run smoke:api
npm run pilot:smoke       # optional; may need env for API URLs
```

---

### STEP 6: Security validation (post-deploy)

```bash
npm run security:g3
```

Requires deployed API URLs / env wired per **`scripts/g3-security-smoke-test.ts`**; a **PASS** supports evidence but **does not** close **G3** without environment proofs and sign-off (**`docs/security/g3-security-controls-platform.md`**).

---

## Troubleshooting

### Infrastructure deployment failures

**Account / profile mismatch**

```bash
export AWS_PROFILE=rapid-cortex-prod    # example
aws sts get-caller-identity
```

With **`EXPECTED_AWS_ACCOUNT_ID`**, **`deploy.sh`** prints **WARN**, not necessarily exit — **stop** if the account is wrong.

**Failed nested events**

```bash
aws cloudformation describe-stack-events \
  --stack-name rapid-cortex-prod \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`]' \
  --output table
```

**Typical causes**

1. IAM — need deploy permissions; nested stacks require **AUTO_EXPAND** (handled in **`deploy.sh`**).
2. **S3 uploads** — SAM **`--resolve-s3`** provisions a managed artifacts bucket prefix; troubleshoot with the bucket/prefix **`sam deploy`** prints on failure (not necessarily a literal **`rapid-cortex-sam-artifacts`** name).
3. **Existing physical names** — DynamoDB/S3 name collisions if recreating stacks.
4. **Lambda build** — confirm **`sam build`** (via **`deploy.sh`**) succeeds; **`CodeUri`** in nested stacks is **`../../apps/api`** relative to **`infra/nested/`**.

### Web SSR / ECS / ALB failures

**CloudFormation (SSR stack)**

```bash
aws cloudformation describe-stacks --stack-name rapid-cortex-web-ssr-prod
aws cloudformation describe-stack-events \
  --stack-name rapid-cortex-web-ssr-prod \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

**Docker** (repo root, local image path only):

```bash
docker build -f Dockerfile.ssr-web -t rapid-cortex-web:test .
```

**ECR**

```bash
aws ecr describe-repositories --repository-names rapid-cortex-web-prod

aws ecr get-login-password --region us-east-1 | docker login \
  --username AWS --password-stdin 158961537080.dkr.ecr.us-east-1.amazonaws.com
```

**ECS + load balancer (cluster `rapid-cortex-web-prod`, service `rapid-cortex-web-prod`)**

```bash
aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region us-east-1 \
  --query 'services[0].events[0:15].[createdAt,message]' \
  --output table

aws ecs list-tasks \
  --cluster rapid-cortex-web-prod \
  --service-name rapid-cortex-web-prod \
  --desired-status STOPPED \
  --region us-east-1
```

Then **`describe-tasks`** on one stopped task ARN for **`stoppedReason`** and container **`exitCode`**.

```bash
aws logs tail /ecs/rapid-cortex-web-prod --region us-east-1 --since 30m
```

Resolve the ALB **target group ARN** from the SSR stack outputs or ECS events, then:

```bash
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN> \
  --region us-east-1
```

**Symptoms → likely cause**

| Symptom | Check |
|---------|--------|
| **`Target.ResponseCodeMismatch`** / health checks **`[500]`** | App returns 500 on the health path. In CloudWatch, **`Cannot find module 'node:crypto'`** in **`.next/server/edge`** usually means **Next.js middleware (Edge)** pulled **`rapid-cortex-shared`** via the **package root** export (which includes RC Lite server code). Middleware and its imports must use **subpath** imports only (e.g. **`rapid-cortex-shared/types`**, **`rapid-cortex-shared/auth/rapid-cortex-roles`**, **`rapid-cortex-shared/auth/session-product`**) — never **`from "rapid-cortex-shared"`** in the middleware graph. |
| Deploy script exits on ECS wait | The script polls **`running` / `desired` / `pending`** and **`PRIMARY.failedTasks`** (see env table). Increase **`ECS_WAIT_MINUTES`** for slow rollouts. If the heuristic passes but AWS still shows churn, inspect **`describe-services` events** and **`describe-target-health`** — the built-in **`aws ecs wait services-stable`** condition is stricter than **`running==desired && pending==0`**. |
| **`failed container health checks`** / **`Task failed ELB health checks`** | Same as 500 / wrong port / crash at boot — correlate **target health** + **task logs**. |

---

## Rollback pointers

```bash
# In-flight update cancellation
aws cloudformation cancel-update-stack --stack-name rapid-cortex-prod

# Recover failed stack updates (CLI v2+) where supported
aws cloudformation rollback-stack --stack-name rapid-cortex-prod
```

SSR stack: **`rollback-stack`** on **`rapid-cortex-web-ssr-prod`** if applicable.

**ECS** — roll task definition revision back to previous after identifying revision numbers in console/`describe-task-definition`.

---

## Validation checklist

- [ ] API health **`GET`** `https://api.rapidcortex.us/api/health` returns **200**
- [ ] Web **`https://www.rapidcortex.us`** returns **200**
- [ ] **CORS** allows **`Origin: https://www.rapidcortex.us`** for applicable routes (test OPTIONS + credentials separately if using cookies)
- [ ] Cognito sign-in succeeds for test user
- [ ] DynamoDB / S3 / Lambdas behaving (smoke **`npm run smoke:api`**)
- [ ] CloudWatch logs and alarms firing as expected when tested
- [ ] **WAF** attached when **`EnableApiWaf`** intended (CLI/console proof)
- [ ] Trail / audit expectations met per design
- [ ] ECS service at desired task count **if** SSR deployed (`rapid-cortex-web-prod` cluster/service)
- [ ] CloudFront/live web origin healthy **if** SSR deployed
- [ ] If you used **`deploy-web-no-docker.sh`**: CodeBuild **SUCCEEDED**, ECS stable (or verified healthy in console), smoke **`smoke-web.sh`** passed unless intentionally skipped

---

## Expected outputs (root stack **`rapid-cortex-prod`**)

| Output key | Description |
|------------|-------------|
| **HttpApiUrl** | HttpApi **`$default` stage invoke URL-style base |
| **ApiCustomDomainUrl** | Custom URL when domain mapping + DNS complete |
| **UserPoolId** | Cognito user pool id |
| **UserPoolClientId** | Web SPA client |
| **NativeUserPoolClientId** | Native PKCE client |
| **AssetsBucketName** | Physical bucket from data-layer nested stack |
| **CognitoIssuer** | Issuer **`https://cognito-idp.{region}.amazonaws.com/{poolId}`** |
| **CognitoHostedUiBase** | Hosted UI base URL fragment |
| **ApiWebAclArn** | Regional WAF Web ACL ARN when deployed |
| **DeploymentStage** | **`prod`** |

Nested stacks **do not publish** standalone stack outputs via the root **`describe-stacks`** table — use **`aws cloudformation describe-stacks --stack-name <NestedStackPhysicalId>`** if you must inspect child outputs during incidents.

---

## Related docs

- [`docs/deployment/prod-deploy-evidence.md`](./prod-deploy-evidence.md)
- [`docs/customer-readiness-gate.md`](../customer-readiness-gate.md)
