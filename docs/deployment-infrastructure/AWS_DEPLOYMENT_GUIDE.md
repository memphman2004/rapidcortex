# AWS Deployment Guide (Production-Native)

This guide deploys Rapid Cortex with **ECS Fargate** for the Next.js SSR web runtime (container image in **ECR**) plus a **SAM** backend. The **runtime** for the web app is **ECS**—not Docker Engine on your own VMs.

## Prerequisites

- AWS account with least-privilege deployment role.
- Existing VPC with public and private subnets.
- Route53 hosted zone for `rapidcortex.us` (or your domain).
- ACM certificates:
  - us-east-1 cert for CloudFront aliases
  - regional cert for ALB HTTPS listener
- **CI image build:** Use a runner with Docker (for example **AWS CodeBuild** with a privileged image, or a self-hosted agent) to run `docker build` / `docker push` to ECR; developers do not need Docker for local UI work (`npm run dev:web`).
- Store deploy credentials and pipeline secrets in your CI system or AWS (OIDC, Secrets Manager)—this repo does not include GitHub or other forge workflow files.

## Required Environment Variables

- Core:
  - `AWS_REGION`
  - `APP_NAME`
  - `STAGE`
- Networking:
  - `VPC_ID`
  - `PRIVATE_SUBNET_IDS` (comma-separated)
  - `PUBLIC_SUBNET_IDS` (comma-separated)
- DNS/TLS:
  - `ROOT_DOMAIN`
  - `ROUTE53_HOSTED_ZONE_ID`
  - `CLOUDFRONT_CERT_ARN`
  - `ALB_CERT_ARN`
- Backend links:
  - `API_BASE_URL`
  - `COGNITO_USER_POOL_ID`
  - `COGNITO_CLIENT_ID`
  - `COGNITO_REGION`

## Deploy Sequence

1. Validate + build:
   - `npm run typecheck`
   - `npm run build`
   - `npm audit`
2. Validate SAM:
   - `npm run sam:validate`
   - `npm run sam:build`
3. Deploy backend:
   - `./scripts/deploy.sh <stage>`
4. Deploy SSR web stack (ECS, ALB, CloudFront, ECR):
   - `./scripts/deploy-web-ssr.sh`
5. Build and push image to ECR:
   - `docker build -f Dockerfile.ssr-web -t <repo>:<tag> .`
   - `docker push <repo>:<tag>`  
   - Or: `./scripts/push-web-ssr-image.sh` (see script for env vars)
6. Roll ECS service to pick up the new image:
   - `aws ecs update-service --cluster <cluster> --service <service> --force-new-deployment`
7. Verify CloudFront distribution + DNS health.

## Rollback

- Web runtime rollback:
  - Re-tag previous ECR image as `latest` (or the tag your task definition uses).
  - Force ECS deployment.
- Infra rollback:
  - CloudFormation stack update rollback or previous template revision.
- Backend rollback:
  - Re-run `sam deploy` with last known-good build/template.

## Security Checklist

- Confirm `ALLOW_UNAUTHENTICATED_API=false` in non-dev.
- Confirm Cognito app/user pool ids match web/desktop configs.
- Confirm WAF ACL is associated with CloudFront.
- Confirm ALB only accepts HTTPS.
- Confirm all S3 buckets used for media are private with Block Public Access.
- Confirm Secrets Manager/SSM are used for keys and API credentials.

## Manual Validation Still Required

- CloudTrail org/account trail integrity/retention policy.
- GuardDuty/Security Hub/Config enablement and finding routing.
- KMS key policy least privilege review.
- WAF false-positive tuning after traffic baseline.
