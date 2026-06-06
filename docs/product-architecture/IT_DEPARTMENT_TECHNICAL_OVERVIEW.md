# Rapid Cortex — IT Department Technical Overview

This document is designed for agency and enterprise IT teams evaluating Rapid Cortex for pilot or production use. It summarizes platform architecture, security controls, deployment options, operational responsibilities, and implementation requirements.

---

## 1) What Rapid Cortex Is

Rapid Cortex is a browser-based operational co-pilot for emergency communications environments. It is designed to assist dispatchers, supervisors, and administrators with:

- Live incident workspace and transcript operations
- AI-assisted analysis and protocol guidance
- Multilingual language support workflows
- Operational oversight (audit, admin, readiness, billing surfaces)

Rapid Cortex is intended to augment existing systems and workflows; it does not claim to replace CAD, telephony, or agency systems of record.

---

## 2) Current Technology Stack

### Frontend

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS + Framer Motion
- TanStack React Query for client data orchestration
- Route model:
  - Public marketing at root (`/`, `/pricing`, etc.)
  - Product application under jurisdiction paths (`/<jurisdiction>/...`)

### Backend

- AWS SAM-managed serverless API (Node.js Lambda + TypeScript)
- API Gateway (HTTP API)
- Cognito for identity and JWT auth
- DynamoDB for core records and audit events
- S3 for media/assets
- Secrets Manager for secret material
- SNS / CloudWatch / CloudFormation operational integrations

### Optional/Associated Runtime

- SSR web runtime available via ECS Fargate + ALB + CloudFront + WAF + Route53 + ECR
- Static web path available via S3 + CloudFront

---

## 3) Reference Architecture (High Level)

1. User authenticates through Cognito-backed flows.
2. Browser calls Next.js routes and/or BFF proxy routes.
3. Next.js server routes proxy secure calls to API upstream where configured.
4. API Gateway routes requests to Lambda handlers.
5. Lambda handlers enforce RBAC, validate payloads (Zod shared schemas), and perform tenant-scoped data access (`agencyId` boundary).
6. Data persists to DynamoDB/S3; events and operational logs are emitted for audit/monitoring.
7. Optional AI and media providers are invoked through configured integrations and secrets.

---

## 4) Security Model (Technical)

Rapid Cortex documents pilot-grade technical controls; this is not a formal certification claim.

### Identity and Access

- Cognito JWT-based authentication and claims mapping (`custom:agencyId`, `custom:role`)
- RBAC checks in backend handlers/services
- Tenant scoping via `agencyId` patterns in data access

### Data Protection

- TLS in transit
- AWS-managed encryption at rest (DynamoDB/S3 defaults), with KMS hardening paths
- Secrets in Secrets Manager (no production secrets committed to repo)

### Logging and Audit

- Audit event model for meaningful state changes
- Sensitive value redaction expectations in logs and API responses
- Operational logging in AWS-native controls

### Control Boundaries

- Browser, Next.js/BFF, API/Lambda, and external provider boundaries are explicitly separated
- External compliance attestations (CJIS/SOC/FedRAMP/HIPAA) require agency/vendor legal and formal assessment processes

---

## 5) Deployment Models

## A) Serverless API + Static Web

- API/data plane via SAM
- Web assets via S3 + CloudFront
- Lower operational overhead, can be suitable for simpler public/marketing delivery

## B) Serverless API + SSR Web Runtime (Recommended for full Next features)

- API/data plane via SAM
- Web runtime via ECS Fargate with ALB and CloudFront edge
- Better fit for full SSR behavior and more advanced runtime controls

---

## 6) Infrastructure Requirements (Typical)

- AWS account and deployment role with least privilege
- Route53 hosted zone for target domain
- ACM certificates:
  - us-east-1 certificate for CloudFront alias
  - regional certificate for ALB HTTPS (SSR model)
- VPC with subnets (SSR model uses explicit VPC/subnet parameters)
- Container build/runtime capability (Docker/CI) for SSR image push to ECR

---

## 7) Integrations and External Dependencies

Rapid Cortex supports optional integration paths including:

- AI provider invocation (config-driven, secret-backed)
- Language services (AWS and optional external provider paths)
- Media/video workflows (including Kinesis-related flows where enabled)
- SMS/notification channels (config-driven)

All external integrations should be reviewed by IT/security with:

- Credential ownership
- Data-sharing scope
- Logging/redaction expectations
- Vendor DPA/contract posture

---

## 8) Data and Tenancy

- Primary tenancy boundary: agency scope (`agencyId`)
- Operational records and audit traces persist in DynamoDB (plus media/object stores where applicable)
- Retention, deletion, and legal-hold expectations are documented and must be validated for agency policy alignment

---

## 9) Operational Readiness and Support

For implementation and run operations, IT teams should align on:

- Environment promotion model (dev/staging/pilot/prod as applicable)
- Deployment runbook and smoke checks
- Monitoring/alert routing and on-call ownership
- Backup/restore and incident response procedures
- Access provisioning/deprovisioning workflows

---

## 10) Responsibilities Matrix (Practical)

### Rapid Cortex / Implementation Team

- Application code, IaC templates, deployment tooling
- Shared schema and RBAC model maintenance
- Product-level runbooks, docs, and technical support inputs

### Agency / Enterprise IT

- Account/network/domain governance
- Identity policy and role mapping approval
- Security review and compliance mapping
- Environment ownership, change control, and operational acceptance

---

## 11) Pilot-to-Production Checklist (IT View)

- [ ] Architecture review completed (zones, data paths, dependencies)
- [ ] Security review completed (auth, RBAC, audit, secret handling)
- [ ] Domain/TLS/DNS ownership and certificate lifecycle established
- [ ] Deployment model selected (static vs SSR) and validated
- [ ] Monitoring/alerting and support escalation owners assigned
- [ ] Backup/restore, retention, and legal-hold posture reviewed
- [ ] Role provisioning and least-privilege access approved
- [ ] Go-live smoke tests and rollback plan rehearsed

---

## 12) Canonical Supporting Docs

- `README.md`
- `docs/INSTALLATION.md`
- `docs/AWS_DEPLOYMENT_GUIDE.md`
- `docs/SECURITY_MODEL.md`
- `docs/API_SURFACE.md`
- `docs/AUTH_OPERATIONS.md`
- `docs/RUNBOOK.md`
- `docs/PILOT_READINESS_CHECKLIST.md`
- `docs/NEXT_DEPLOY_BLOCKERS.md`

