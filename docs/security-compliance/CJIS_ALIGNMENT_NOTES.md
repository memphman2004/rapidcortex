# CJIS alignment notes (engineering)

Rapid Cortex is built for **public safety** workloads where CJIS Security Policy is often in scope. This document describes **alignment goals** and **technical controls** — **not** CJIS certification or FBI approval.

## Authentication & access control

- Primary identity: **AWS Cognito** with ID tokens verified server-side (`jose` + JWKS).
- **Least privilege:** role-based access via `custom:role` mapped to `UserRole` in `rapid-cortex-shared`.
- **Inactive accounts:** `custom:status` must be `active` for API access.

## Audit & accountability

- Audit table patterns and admin actions should emit immutable records (implementation varies by route).
- Prefer **CloudTrail** + **S3 Object Lock** (see template CloudTrail bucket) for infrastructure-level proof.

## Encryption

- **In transit:** TLS for browser ↔ app ↔ API.
- **At rest:** DynamoDB encryption (AWS-managed); S3 **SSE-S3** (or KMS where policy requires) — `AssetsBucket` now declares default encryption in SAM.

## Media & third-party AI

- **CJIS-sensitive mode (config goal):** keep AI and storage in **GovCloud/us-gov** partitions and use **AWS-native** services only; disable external OpenAI/Anthropic keys via unset secret ARNs and feature flags.
- **Logging:** never log raw transcripts, prompts, or media URLs in application logs.

## Policy mapping (informal)

| CJIS area | Product direction |
|-----------|-------------------|
| Access control | RBAC + tenant isolation |
| Audit & accountability | Audit logs + CloudTrail |
| Identification & authentication | Cognito MFA-ready |
| Configuration management | IaC in SAM; Config recommended |
| Incident response | `docs/INCIDENT_RESPONSE_RUNBOOK.md` |

## SOC 2–ready (informal)

- Change management via PR + CI.
- Logging and monitoring hooks (extend `logSecurityEvent`).
- Vendor management for AI/STT providers — document DPA and data residency.

## What this repo does **not** prove

- Operational CJIS compliance for a specific agency environment.
- Physical security, personnel screening, or security awareness training.
