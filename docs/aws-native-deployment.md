# AWS-native deployment (split lanes)

Rapid Cortex intentionally separates **slow Next.js builds** from **SAM API packaging** so backend deploys are not blocked by the web workspace.

## Lanes

| Lane | What runs | How |
|------|-----------|-----|
| Backend + data + Cognito + RC Lite (`/api/v1`) | SAM nested stack | `./scripts/deploy.sh <dev\|staging\|prod\|pilot>` |
| Next.js web (ECS) | CodeBuild builds `Dockerfile.web` in AWS — no Docker Desktop | `./scripts/deploy-web-ecs.sh <dev\|staging\|prod>` after pipeline stacks exist |
| Static marketing (optional split) | S3 + CloudFront | `npm run deploy:marketing` (build → verify → S3 sync → post-verify). Infra stack only: `./scripts/deploy-marketing.sh --hosting` |
| Desktop installers | S3 + CloudFront (`infra/downloads-hosting.yaml`) | `./scripts/upload-desktop-downloads.sh …` — publishes **`https://downloads.rapidcortex.us/latest.json`** plus `mac/latest/…`, `windows/latest/…` (see `docs/desktop-downloads.md`) |
| Web smoke | **ALB HTTPS** derived from ECS stack **`Outputs.LoadBalancerDns`** | `./scripts/smoke-web.sh` (needs `SMOKE_WEB_STACK_NAME` if not `rapid-cortex-web-ecs-<prod>`) or `./scripts/smoke-web.sh https://www.…` |

## SAM script behavior

- **Default** skips `npm run build -w rapid-cortex-web` (Next is not part of Lambda artifacts).
- **`SAM_BUILD_USE_CACHE=0`** forces a cold `sam build`.
- **`SAM_PARALLEL=0`** disables parallel function builds.
- **`BUILD_WEB_BEFORE_SAM=1`** opt-in monorepo web build before SAM (rare; mostly CI validation).
- **`SAM_BUILD_DIR=/path/with/space`** uses a roomy disk path (`mkdir -p`).

## Web container pipeline (first-time)

1. Deploy ECR: `infra/web-ecr.yaml` (`RepositoryNameSuffix` defaults to `rapid-cortex-web`).
2. Deploy pipeline bucket + CodeBuild: `infra/web-pipeline-codebuild.yaml` (upload `web-source.zip` with `scripts/package-web-source.sh`).
3. Deploy ECS service: `infra/web-ecs-fargate.yaml` (VPC + public subnets + ACM **in-region** ARN).
4. Run `./scripts/deploy-web-ecs.sh <env>` whenever you want a fresh image from the zipped tree.

Container / ALB health checks MUST target **`GET /api/health/web`** (liveness-only). The legacy **`GET /api/health`** route still proxies the Lambda **`/api/health`** probe when **`API_UPSTREAM_BASE`** is set—don’t swap those without updating operational dashboards first.

Poll CodeBuild logs in the AWS console; roll ECS tasks after pushes:

```bash
aws ecs update-service \
  --cluster rapid-cortex-web-prod \
  --service rapid-cortex-web-prod \
  --force-new-deployment \
  --region "${AWS_REGION:-us-east-1}"
```

## RC Lite routing

`/api/v1/*` stays on the primary HttpApi with the rest of Rapid Cortex Lambdas until a future split warrants a dedicated custom domain stack.
