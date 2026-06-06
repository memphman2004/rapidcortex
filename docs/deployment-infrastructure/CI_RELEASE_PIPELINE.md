# CI and release (no bundled forge config)

This repository **does not** ship GitHub Actions, GitLab CI, Azure Pipelines, or other vendor-specific workflow files. Operators own CI/CD in their own systems (for example **AWS CodePipeline**, **CodeBuild**, Jenkins, Buildkite, or internal runners).

Use **[DEPLOYMENT.md](./DEPLOYMENT.md)** and **[AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md)** for SAM and ECS steps. Below is a **reference order** you can mirror in any pipeline.

## Suggested quality gates (before deploy)

- `npm ci`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate` (policy as you require)
- `npm run test:ci` (or `npm run test` + `npm run test:security` per your split)
- `npm run lint:web`
- `npm run validate:iam`
- Optional: IaC scan (Checkov) on `infra/`, filesystem scan (Trivy) on the repo, Semgrep with `.semgrep/security.yml`, SAST (e.g. CodeQL) in whatever platform you use.

## Suggested release sequence (API + ECS web)

Assume `STAGE` is `staging`, `pilot`, or `prod`, and AWS credentials are available to the runner.

1. **SAM API:** `./scripts/deploy.sh "$STAGE"` (see `DEPLOYMENT.md` for env vars such as `HTTP_API_CORS_ORIGINS`).
2. **SSR web stack (creates ECR):** export the variables required by `scripts/deploy-web-ssr.sh` (VPC, subnets, certs, Cognito IDs, `API_BASE_URL`, etc.), then `./scripts/deploy-web-ssr.sh`.
3. **Image to ECR:** set `STACK_NAME=rapid-cortex-web-ssr-$STAGE`, resolve `WebEcrRepositoryUri` from CloudFormation outputs, then build and push (same logic as former automation):

   ```bash
   export AWS_REGION="us-east-1"   # your region
   export STAGE="prod"
   export STACK_NAME="rapid-cortex-web-ssr-${STAGE}"
   export RELEASE_TAG="${CI_COMMIT_SHA:-$(git rev-parse HEAD)}"

   REPO_URI=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
     --query "Stacks[0].Outputs[?OutputKey=='WebEcrRepositoryUri'].OutputValue" --output text)
   REGISTRY="$(echo "$REPO_URI" | cut -d/ -f1)"

   aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"
   docker build -f Dockerfile.ssr-web -t "$REPO_URI:${RELEASE_TAG}" -t "$REPO_URI:latest" .
   docker push "$REPO_URI:${RELEASE_TAG}"
   docker push "$REPO_URI:latest"
   ```

4. **CJIS / environment validation (optional gate):** `bash scripts/validate-aws-environment.sh` with the stage name your org uses (e.g. map `prod` → `production` if that script expects it).
5. **Roll ECS:** read `EcsClusterName` and `EcsServiceName` from the same stack outputs, then:

   ```bash
   CLUSTER=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
     --query "Stacks[0].Outputs[?OutputKey=='EcsClusterName'].OutputValue" --output text)
   SERVICE=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
     --query "Stacks[0].Outputs[?OutputKey=='EcsServiceName'].OutputValue" --output text)
   aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment
   ```

## IAM for CI deploy principals

Edit placeholders in [`infra/iam/sam-deploy-policy.json`](../../infra/iam/sam-deploy-policy.json) and attach the policy to a role or user your pipeline assumes. For **OIDC** (recommended over long-lived keys), create an IAM OIDC provider and trust policy in the **AWS console** or your IaC repo for **your** IdP’s issuer URL and audience—this repository does not ship a GitHub-specific trust JSON.
