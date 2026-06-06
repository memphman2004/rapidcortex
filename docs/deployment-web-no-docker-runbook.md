# Rapid Cortex — Web deployment runbook (no local Docker)

This runbook describes how to ship **`apps/web`** using **AWS CodeBuild** (Docker runs in AWS only), **ECR**, **ECS Fargate**, and **CloudFront**. One-shot automation lives in **`scripts/deploy-web-no-docker.sh`**.

**Related scripts**

| Script | Purpose |
|--------|---------|
| `scripts/deploy-web-no-docker.sh` | Zip → S3 → CodeBuild → ECS create-if-missing / roll → invalidate CloudFront → `smoke-web.sh` |
| `scripts/deploy-web-ssr.sh` | Provision/update SSR **infrastructure** (`infra/web-ssr-infra-template.yaml`). Not app releases. |

---

## Prerequisites

From the repo root (`Rapid Cortex/`), verify resources exist (**adjust account/region** if needed):

```bash
export AWS_REGION="${AWS_REGION:-us-east-1}"

aws ecr describe-repositories \
  --repository-names rapid-cortex-web-prod \
  --region "$AWS_REGION"

aws codebuild batch-get-projects \
  --names rapid-cortex-web-build-prod \
  --region "$AWS_REGION" \
  --query '{count:length(projects),names:projects[*].name}'

aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region "$AWS_REGION" \
  --query 'services[0].{desired:desiredCount,running:runningCount,status:status,taskDefinition:taskDefinition}'

aws cloudformation describe-stacks \
  --stack-name rapid-cortex-web-ssr-prod \
  --region "$AWS_REGION" \
  --query 'Stacks[0].StackStatus'
```

- **ECR** is created via **`infra/web-ecr.yaml`** (stack commonly `rapid-cortex-web-ecr-prod`; repository name `rapid-cortex-web-prod`).
- **CodeBuild + source bucket**: **`infra/web-pipeline-codebuild.yaml`** as stack **`rapid-cortex-web-pipeline-prod`**. Project name **`rapid-cortex-web-build-prod`**. If `batch-get-projects` returns **`count: 0`**, deploy that stack before using the automated script.
- **ECS / CloudFront / ALB**: **`rapid-cortex-web-ssr-prod`** (from `infra/web-ssr-infra-template.yaml` via `scripts/deploy-web-ssr.sh`).
- **`buildspec.web.yml`** uses **`nodejs: 22`** (not Node 18).

---

## Option 1 — Full automated deployment (recommended)

Single command:

```bash
./scripts/deploy-web-no-docker.sh prod
```

It will, in order:

1. Confirm **ECR** `rapid-cortex-web-prod` exists.
2. Confirm **CodeBuild** project **`rapid-cortex-web-build-prod`** exists.
3. **`scripts/package-web-source.sh`** → `web-source-prod.zip`
4. **`scripts/upload-web-source.sh`** → S3 (**`WEB_PIPELINE_STACK_NAME`**, default `rapid-cortex-web-pipeline-prod`)
5. **Start CodeBuild**, wait until **SUCCEEDED**
6. **`aws ecs update-service --force-new-deployment`** on **`rapid-cortex-web-prod`**
7. **`aws ecs wait services-stable`**
8. **`CloudFront`** invalidation `/*` if stack **`rapid-cortex-web-ssr-prod`** exports **`CloudFrontDistributionId`**
9. **`scripts/smoke-web.sh`** ( **`SMOKE_WEB_STACK_NAME`** defaults to SSR stack )

Exact console messages may differ slightly (e.g. step labels); behavior matches the script.

**Live URL**: read **`CloudFrontDomainName`** from stack outputs (avoid hardcoding a distribution hostname in permanent docs):

```bash
aws cloudformation describe-stacks \
  --stack-name rapid-cortex-web-ssr-prod \
  --region "$AWS_REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text
```

---

## Option 2 — Quick path (manual steps)

Already documented in-repo via:

```bash
./scripts/package-web-source.sh prod
./scripts/upload-web-source.sh prod
./scripts/start-web-codebuild.sh prod
```

After the image is in **ECR**, roll ECS:

```bash
aws ecs update-service \
  --cluster rapid-cortex-web-prod \
  --service rapid-cortex-web-prod \
  --force-new-deployment \
  --region "$AWS_REGION"

aws ecs wait services-stable \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region "$AWS_REGION"
```

---

## Post-deployment verification

Set **`BASE_URL`** to **`https://${CloudFrontDomainName}`** (or ALB DNS to bypass CDN cache):

```bash
BASE_URL="https://YOUR_CLOUDFRONT_HOST"
```

### 1. Health

```bash
curl -fsS "${BASE_URL}/api/health" | jq .

curl -fsS "${BASE_URL}/api/health/web" | jq .

curl -fsS "${BASE_URL}/api/health/upstream" | jq .
```

- **`/api/health`** — Next.js web process (“container” probe); **`deploymentStage`** comes from task env (**`DEPLOY_STAGE`**).
- **`/api/health/web`** — Same app, extra fields (e.g. memory MB).
- **`/api/health/upstream`** — Proxies **`API_UPSTREAM_BASE`** Lambda **`/api/health`** (needs gateway configured on the task).

### 2. Marketing routes

```bash
curl -sI "${BASE_URL}/downloads" | head -n 1

curl -fsS "${BASE_URL}/downloads" | grep -qi "Rapid Cortex Downloads" && echo "downloads HTML OK"

curl -fsS "${BASE_URL}/rc-lite" | grep -qiE 'rc-lite|RC[[:space:]]*Lite' && echo "rc-lite HTML OK"

curl -sI "${BASE_URL}/developers/api" | head -n 1
```

**Note**: Grepping for **`RC Lite API`** may fail if the page copy uses **`RC Lite`** only; **`smoke-web.sh`** uses a flexible pattern.

### 3. Reserved first segments (not jurisdiction slugs)

Some paths may **`302`** (e.g. auth) or **`404`** if the route does not exist; **`/downloads`**, **`/rc-lite`** should be **`200`** when the marketing build + middleware fixes are deployed:

```bash
for route in downloads rc-lite pricing solutions billing cad-integration media; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}/${route}")"
  echo "/${route} → ${code}"
done
```

### 4. Home / footer hints (HTML varies with RSC)

```bash
curl -fsS "${BASE_URL}/" | grep -q "Downloads" && echo "Home mentions Downloads" || echo "Downloads not in first HTML chunk"

curl -fsS "${BASE_URL}/" | grep -q "downloads.rapidcortex.us" && echo "Footer CDN hints OK" || echo "CDN substring not in first HTML chunk"
```

### 5. Full smoke suite

```bash
SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod DEPLOY_STAGE=prod ./scripts/smoke-web.sh --

./scripts/smoke-web.sh "${BASE_URL}"
```

Direct ALB (bypass CloudFront):

```bash
./scripts/smoke-web.sh "https://YOUR_ALB_DNS"
```

(ALB hostname is in SSR stack output **`AlbDnsName`** or ECS / console.)

---

## Environment variable overrides (`deploy-web-no-docker.sh`)

```bash
# Custom repository (default rapid-cortex-web-${ENV})
WEB_ECR_REPOSITORY_NAME=my-custom-repo ./scripts/deploy-web-no-docker.sh prod

WEB_CODEBUILD_PROJECT_NAME=my-web-build ./scripts/deploy-web-no-docker.sh prod

WEB_PIPELINE_STACK_NAME=my-pipeline-stack ./scripts/deploy-web-no-docker.sh prod

ECS_CLUSTER_NAME=my-cluster ECS_SERVICE_NAME=my-service ./scripts/deploy-web-no-docker.sh prod

WEB_SSR_STACK_NAME=my-ssr-stack ./scripts/deploy-web-no-docker.sh prod

SKIP_CLOUDFRONT_INVALIDATION=1 ./scripts/deploy-web-no-docker.sh prod

SKIP_SMOKE=1 ./scripts/deploy-web-no-docker.sh prod

SMOKE_DELAY_SECONDS=30 ./scripts/deploy-web-no-docker.sh prod
```

**`DEPLOY_STAGE` / `STAGE`** affect **`scripts/smoke-web.sh`** correlation (passed through when invoked from the deploy script).

---

## Troubleshooting

### `/downloads` still **`307`** or wrong body after deploy

Often **cached** at CloudFront. Invalidate:

```bash
DIST_ID="$(
  aws cloudformation describe-stacks \
    --stack-name rapid-cortex-web-ssr-prod \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue | [0]" \
    --output text
)"

aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*"
```

Wait a few minutes, then retest (**`curl -sI`** and **`Accept-Encoding`** can influence edge behavior).

### **`/api/health/web`** returns **`404`**

Task image may predate that route.b Build + deploy again CodeBuild succeeds and ECS picks up **`latest`** (or the tag referenced by the task definition).

```bash
TASK_DEF="$(aws ecs describe-services \
  --cluster rapid-cortex-web-prod \
  --services rapid-cortex-web-prod \
  --region "${AWS_REGION}" \
  --query 'services[0].taskDefinition' --output text)"

aws ecs describe-task-definition \
  --task-definition "${TASK_DEF}" \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.containerDefinitions[0].image' \
  --output text

aws ecs update-service \
  --cluster rapid-cortex-web-prod \
  --service rapid-cortex-web-prod \
  --force-new-deployment \
  --region "${AWS_REGION}"
```

### **`next build`**: **`exports is not defined`** loading **`next.config`**

Indicates **ESM vs CJS** mismatch for Next’s config loader. Prefer one style only (e.g. **`export default nextConfig`** from **`next.config.ts`**) or migrate to **`next.config.mjs` / `.js`** with matching syntax. Resolve before relying on CodeBuild.

### CodeBuild **`Cannot find module`**

Inspect logs:

```bash
aws logs tail "/aws/codebuild/rapid-cortex-web-build-prod" \
  --since 30m \
  --region "${AWS_REGION}"
```

Ensure the zip from **`package-web-source.sh`** includes **`package.json`**, **`package-lock.json`**, **`apps/`**, **`packages/`**, Dockerfile, **`buildspec.web.yml`**. CodeBuild’s **`Dockerfile.web`** stage runs **`npm ci`** inside the image build context.

### ECS tasks unhealthy / crash loop

```bash
aws logs tail "/ecs/rapid-cortex-web-prod" \
  --since 30m \
  --region "${AWS_REGION}"
```

Check task/env:

```bash
aws ecs describe-task-definition \
  --task-definition rapid-cortex-web-prod \
  --region "${AWS_REGION}" \
  --query 'taskDefinition.containerDefinitions[0].environment'
```

(Log group name may differ; confirm in the task definition’s **`logConfiguration`**.)

---

## Prerequisites check (this workspace, example)

Ran against **`us-east-1`** while authoring this doc:

| Check | Result (example) |
|-------|------------------|
| **ECR** `rapid-cortex-web-prod` | Exists |
| **CodeBuild** `rapid-cortex-web-build-prod` | **`count: 0`** unless pipeline stack deployed |
| **ECS** service | **ACTIVE**, desired/running aligned |
| **CloudFormation** `rapid-cortex-web-ssr-prod` | **`UPDATE_COMPLETE`** |

If **CodeBuild** is missing, deploy **`infra/web-pipeline-codebuild.yaml`** first (**`rapid-cortex-web-pipeline-prod`** with **`Environment=prod`**).
