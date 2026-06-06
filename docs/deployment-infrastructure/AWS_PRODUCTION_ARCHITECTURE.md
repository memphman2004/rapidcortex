# Rapid Cortex AWS Production Architecture

This document defines the long-term AWS-native runtime for Rapid Cortex web + desktop clients.

> CJIS note: this architecture is CJIS-aligned design guidance and implementation posture, not a CJIS certification claim.

## Target Topology

```text
Route 53 (rapidcortex.us, www.rapidcortex.us)
  -> CloudFront (TLS, response headers, WAF association)
    -> AWS WAF (managed rules + rate limiting)
      -> Application Load Balancer (HTTPS listener)
        -> ECS Fargate service (Next.js SSR web runtime)
          -> API Gateway (regional)
            -> Lambda services (Rapid Cortex API)
              -> Cognito + DynamoDB + S3 + KMS + CloudWatch + CloudTrail
```

## Service Responsibilities

- Route 53: authoritative DNS for apex + `www`.
- CloudFront: edge TLS, HTTPS redirect, origin shielding, secure headers.
- WAF: managed threat signatures + abusive client rate control.
- ALB: layer-7 ingress for SSR service health and scaling.
- ECS Fargate: stateless Next.js SSR runtime (no secrets baked into images).
- API Gateway + Lambda: backend APIs shared by web/macOS/Windows clients.
- Cognito: centralized identity, role/agency/status claims.
- DynamoDB: tenant-scoped operational data (`agencyId` on access path).
- S3: private media + exports through signed URLs only.
- KMS: encryption keys for data stores and secrets.
- CloudWatch/CloudTrail: runtime observability + security audit trail.

## Security Controls Baseline

- No unauthenticated production API mode.
- Backend-enforced JWT validation (signature, issuer, audience/client), role, `agencyId`, and `custom:status=active`.
- Explicit cross-tenant denial in backend services.
- S3 Block Public Access and no public ACL usage.
- KMS-backed encryption at rest where supported.
- TLS in transit from edge to origin and client to APIs.
- WAF for edge traffic plus API-layer controls in SAM stack.
- Secrets via Secrets Manager/SSM, not source-controlled values.

## SSR Runtime Stack (Implemented in Repo)

- Template: `infra/web-ssr-infra-template.yaml`
- Includes:
  - ECR repository with scan-on-push
  - ECS cluster + Fargate service + task definition
  - ALB + target group + `/api/health` health check
  - Autoscaling policy
  - CloudWatch log group + alarms
  - CloudFront distribution in front of ALB
  - WAF ACL with managed rules + rate limit
  - Route53 alias records for apex + `www`

## Required AWS Console / Org Validations

- Confirm CloudTrail is organization-wide with immutable retention policy requirements for your compliance program.
- Confirm GuardDuty, Security Hub, and AWS Config are enabled in target account(s).
- Validate alarm destinations (SNS/PagerDuty/Slack) and escalation ownership.
- Validate key policies for least-privilege access to KMS keys and secrets.
- Validate production certificates and DNS ownership for both CloudFront and ALB cert chains.

## Cost Notes (Test Stage)

- CloudFront + WAF + ALB + Fargate is materially more expensive than static hosting.
- Start with:
  - 2 Fargate tasks (1 vCPU / 2 GB) for HA baseline.
  - CloudFront PriceClass_100 where latency profile allows.
  - Right-size CloudWatch retention by log type.
- Expect major cost drivers: Fargate hours, CloudFront egress, WAF request volume.
