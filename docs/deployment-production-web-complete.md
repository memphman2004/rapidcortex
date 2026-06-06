# Rapid Cortex — production web deployment guide (complete)

This guide ties together **infra**, **`scripts/deploy-web-no-docker.sh`**, **smoke tests**, and **manual verification**. For pipeline-only prerequisites, see also **`docs/deployment-web-no-docker-runbook.md`**.

---

## Current state (typical)

**Infrastructure**

- **ECR:** `rapid-cortex-web-prod`
- **ECS:** cluster/service `rapid-cortex-web-prod` (often 2/2 tasks)
- **CloudFormation:** `rapid-cortex-web-ssr-prod` (ALB + CloudFront + ECS + …)
- **CodeBuild:** `rapid-cortex-web-build-prod` (+ S3 source bucket from stack **`rapid-cortex-web-pipeline-prod`**)

**Code in repo** (already on `main`/your branch — examples)

- Reserved marketing segments (`middleware.ts` + `lib/reserved-public-route-segments.ts`)
- `GET /api/health`, `GET /api/health/web`, `GET /api/health/upstream`
- Marketing routes: **`/downloads`**, **`/rc-lite`**, **`/developers/api`**
- **`scripts/smoke-web.sh`** (markers, troubleshooting hints, optional strict health-web)

Until a **new image** is built in CodeBuild and ECS rolls tasks, production can still serve an **older** image (e.g. missing **`/api/health/web`** or wrong **`/downloads`** body). **Deploy + optional CloudFront invalidation** fixes that.

---

## Step 1 — Deploy new image (recommended)

From the **monorepo root**:

```bash
./scripts/deploy-web-no-docker.sh prod
```

**What happens** (implemented in-repo)

1. Assert **ECR** + **CodeBuild** exist  
2. **`scripts/package-web-source.sh`** → `web-source-prod.zip`  
3. **`scripts/upload-web-source.sh`** → S3 (**`rapid-cortex-web-pipeline-prod`** output bucket)  
4. **Start CodeBuild** (`Dockerfile.web` + **`buildspec.web.yml`**, Node **22**)  
5. **Wait** until build **SUCCEEDED** (~5–15 min typical)  
6. **`aws ecs update-service --force-new-deployment`**  
7. **`aws ecs wait services-stable`**  
8. **CloudFront** invalidation **`/*`** using **`CloudFrontDistributionId`** from **`rapid-cortex-web-ssr-prod`** (unless **`SKIP_CLOUDFRONT_INVALIDATION=1`**)  
9. **`scripts/smoke-web.sh`** (unless **`SKIP_SMOKE=1`**)

Banner text differs slightly from any marketing “expected output” screenshots but the **steps above** match the script.

**Useful overrides**

```bash
SKIP_SMOKE=1 ./scripts/deploy-web-no-docker.sh prod
SKIP_CLOUDFRONT_INVALIDATION=1 ./scripts/deploy-web-no-docker.sh prod
SMOKE_DELAY_SECONDS=30 ./scripts/deploy-web-no-docker.sh prod

# Fail pipeline smoke if /api/health/web is still 404 / missing
SMOKE_REQUIRE_HEALTH_WEB=1 ./scripts/deploy-web-no-docker.sh prod
```

**Live hostname:** resolve from stack (**do not rely on a single hardcoded domain**):

```bash
aws cloudformation describe-stacks \
  --stack-name rapid-cortex-web-ssr-prod \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text
```

Use **`https://<that-host>`** as **`BASE_URL`** below.

---

## Step 2 — Manual verification (after deploy)

```bash
BASE_URL="https://YOUR_CLOUDFRONT_DOMAIN"

# Health (web vs upstream Lambda)
curl -fsS "${BASE_URL}/api/health" | jq .
curl -fsS "${BASE_URL}/api/health/web" | jq .
curl -fsS "${BASE_URL}/api/health/upstream" | jq .
```

**Notes**

- **`/api/health`** — Next.js container JSON (`rapid-cortex-web`).  
- **`/api/health/web`** — Same app + e.g. `memory`/`component`; **404** ⇒ old task image.  
- **`/api/health/upstream`** — Proxies **`API_UPSTREAM_BASE`**. **`500`** if not configured on the task; not always a regression.

**Marketing HTML** (titles are lowercase in JSX in places — use **case-insensitive** checks):

```bash
curl -fsS "${BASE_URL}/downloads" | grep -qi "Download for Mac" && echo "downloads OK"

curl -fsS "${BASE_URL}/rc-lite" | grep -qi "RC Lite" && echo "rc-lite OK"

curl -fsS "${BASE_URL}/developers/api" | grep -qi "API documentation" && echo "developers/api OK"

curl -fsS "${BASE_URL}/downloads" | grep -q "downloads.rapidcortex.us/mac" && echo "Mac CDN OK"
curl -fsS "${BASE_URL}/downloads" | grep -q "downloads.rapidcortex.us/windows" && echo "Windows CDN OK"
```

**Status codes** (expect **200** for static marketing shells; **`302`**/`307` may still occur for gated or missing routes):

```bash
for route in downloads rc-lite pricing solutions billing cad-integration; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}/${route}")"
  echo "/${route} → ${code}"
done
```

**Bypass CloudFront** when debugging cache vs origin:

```bash
ALB_DNS="$(
  aws cloudformation describe-stacks \
    --stack-name rapid-cortex-web-ssr-prod \
    --region us-east-1 \
    --query "Stacks[0].Outputs[?OutputKey=='AlbDnsName'].OutputValue" \
    --output text
)"
curl -fsS "https://${ALB_DNS}/downloads" | grep -qi "Download for Mac" && echo "ALB downloads OK"
```

---

## Step 3 — Smoke tests

**Resolve URL from AWS (recommended)**

```bash
SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod \
DEPLOY_STAGE=prod \
./scripts/smoke-web.sh --
```

**Or pin URL**

```bash
DEPLOY_STAGE=prod ./scripts/smoke-web.sh "https://YOUR_CLOUDFRONT_DOMAIN"
```

**Strict CI / post-deploy gate** (**fail** if **`/api/health/web`** is missing):

```bash
SMOKE_REQUIRE_HEALTH_WEB=1 \
SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod \
DEPLOY_STAGE=prod \
./scripts/smoke-web.sh --
```

With **`SMOKE_REQUIRE_HEALTH_WEB=1`**, the smoke banner includes a **strict mode** line.

---

## Troubleshooting

### **`/api/health/web`** still **404**

Tasks are likely still an old image digest.

```bash
aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region us-east-1 \
  --query 'services[0].deployments' \
  --output json

TASK_DEF="$(aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region us-east-1 \
  --query 'services[0].taskDefinition' \
  --output text)"

aws ecs describe-task-definition \
  --task-definition "${TASK_DEF}" \
  --region us-east-1 \
  --query 'taskDefinition.containerDefinitions[0].image' \
  --output text
```

Then **`force-new-deployment`** again after verifying **ECR `latest`** (or pinned tag) was pushed by CodeBuild:

```bash
aws ecs update-service \
  --cluster rapid-cortex-web-prod \
  --service rapid-cortex-web-prod \
  --force-new-deployment \
  --region us-east-1

aws ecs wait services-stable \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region us-east-1
```

### **`/downloads`** wrong body on CloudFront but OK on ALB

Invalidate:

```bash
DIST_ID="$(aws cloudformation describe-stacks \
  --stack-name rapid-cortex-web-ssr-prod \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)"

aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*"
```

Optional wait:

```bash
INV_ID="$(aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)"

aws cloudfront wait invalidation-completed \
  --distribution-id "${DIST_ID}" \
  --id "${INV_ID}"
```

### CodeBuild failures

```bash
aws logs tail "/aws/codebuild/rapid-cortex-web-build-prod" \
  --since 1h \
  --region us-east-1
```

### ECS tasks crash looping

```bash
aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --query 'services[0].events[:10]' \
  --region us-east-1 \
  --output table
```

Inspect log group/stream from task definition (**name may vary**):

```bash
aws logs tail "/ecs/rapid-cortex-web-prod" \
  --since 30m \
  --region us-east-1
```

---

## Checklist

| Area | Check |
|------|--------|
| Infra | **CodeBuild**, **ECR**, **ECS 2/2**, **SSR** stack **UPDATE_COMPLETE** / **CREATE_COMPLETE** |
| Build | CodeBuild **SUCCEEDED**; image in **ECR** |
| ECS | **`force-new-deployment`** + **stable**; task **image URI** refreshed |
| Web | **`/api/health`**, **`/api/health/web`** (after new image); **`/downloads`** markers |
| CDN | Invalidate **`/*`** if edge still stale vs ALB |
| Smoke | Default **`./scripts/smoke-web.sh --`**; **`SMOKE_REQUIRE_HEALTH_WEB=1`** for strict |

---

## Quick reference

```bash
./scripts/deploy-web-no-docker.sh prod

SMOKE_REQUIRE_HEALTH_WEB=1 \
SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod \
DEPLOY_STAGE=prod \
./scripts/smoke-web.sh --

aws ecs update-service \
  --cluster rapid-cortex-web-prod \
  --service rapid-cortex-web-prod \
  --force-new-deployment \
  --region us-east-1
```

Estimated wall time **~15–25 minutes**, dominated by CodeBuild image build and ECS roll.
