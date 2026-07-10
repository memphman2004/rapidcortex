# Subprocessor list (draft)

**Audience:** agency security, legal, and procurement reviewers.  
**Status:** **DRAFT** — review quarterly and before each major architecture change.  
**Not exhaustive** of every AWS API call; lists **categories of third parties** that may process customer data when features are enabled.

Rapid Cortex is primarily deployed on **Amazon Web Services (us-east-1** by default unless contract specifies otherwise). Customer data is scoped by **`agencyId`** tenant isolation.

---

## 1. Infrastructure (always on for hosted SaaS)

| Subprocessor | Purpose | Data categories | Region / notes |
|--------------|---------|-----------------|----------------|
| **Amazon Web Services** | Hosting: Lambda, API Gateway, DynamoDB, S3, Cognito, CloudWatch, Secrets Manager, SES, SNS, EventBridge, ECS/Fargate, CloudFront, Route 53, ACM, WAF (when enabled) | Account metadata, incident data, transcripts, audit logs, auth tokens (server-side), media objects | Customer stack region; see [SECURITY_MODEL.md](./SECURITY_MODEL.md) |

---

## 2. AI and language (when enabled — default on most stacks)

| Subprocessor | Purpose | Data categories | Region / notes |
|--------------|---------|-----------------|----------------|
| **Amazon Bedrock** | Incident analysis, triage, summarization | Transcript excerpts, incident metadata | AWS region of Bedrock endpoint |
| **Amazon Transcribe** | Speech-to-text | Audio / stream metadata | AWS |
| **Amazon Translate** | Text translation | Transcript text | AWS |
| **Amazon Comprehend** | Language detection / NLP tiers | Transcript text | AWS |

Optional (only if secret ARNs configured — **off** in CJIS-sensitive posture):

| Subprocessor | Purpose | Data categories |
|--------------|---------|-----------------|
| **OpenAI** | Alternate analysis provider | Prompts / transcripts per handler config |
| **Anthropic** | Alternate analysis provider | Prompts / transcripts per handler config |
| **Microsoft Azure** (Speech / Translator) | Alternate STT / translation | Audio / text per env |
| **Google Cloud** | Alternate STT / translation | Audio / text per service account |

Disable external keys by leaving ARNs unset — see [DEPLOYMENT_MULTILINGUAL_AWS.md](../deployment-infrastructure/DEPLOYMENT_MULTILINGUAL_AWS.md) and [CJIS_ALIGNMENT_NOTES.md](./CJIS_ALIGNMENT_NOTES.md).

---

## 3. Communications and integrations (feature-gated)

| Subprocessor | Purpose | Data categories | When used |
|--------------|---------|-----------------|-----------|
| **Amazon SES** | Transactional email (invites, billing, notifications) | Email addresses, message content | When email features enabled |
| **Amazon SNS** | Ops alerts, optional SMS | Phone/email for alerts | Operator-configured |
| **Amazon Pinpoint** | SMS / messaging links (e.g. caller media intake) | Phone numbers, message metadata | When Pinpoint features enabled |
| **Twilio** (or adapter) | Telephony / SMS integrations | Call/SMS metadata | Only if integration deployed and configured |
| **Ring** (partner API) | Camera / doorbell integrations | Device metadata, media | Ring Connect module only |
| **CAD vendor systems** | Read or write adapters | Incident/unit data per agency | Agency-controlled endpoints |

---

## 4. Payments (billing module)

| Subprocessor | Purpose | Data categories |
|--------------|---------|-----------------|
| **Payment processor** (per agency contract) | Invoicing / card processing | Billing contact, payment metadata |

Configure per [pricing-billing](../pricing-billing/) docs; not all pilots enable billing Lambdas.

---

## 5. Desktop distribution

| Subprocessor | Purpose | Data categories |
|--------------|---------|-----------------|
| **Amazon S3 + CloudFront** | Presigned desktop installer URLs | Download audit metadata |
| **Apple / Microsoft** (platform) | OS notarization / SmartScreen | Installer binaries |

---

## 6. Customer responsibilities

Agencies remain responsible for:

- Identity provider policies (MFA, account lifecycle)
- CAD, radio, CPE, and logging systems of record
- Workstation and network security
- Personnel screening per CJIS or state policy
- Executed DPAs with any **agency-chosen** integrators

---

## 7. Updates

| Version | Date | Change |
|---------|------|--------|
| 0.1 | 2026-07-09 | Initial draft from `infra/template.yaml` and provider docs |

**Contact:** security review requests — use agency contract channel or `privacy@rapidcortex.us` for privacy-specific questions.

**Related:** [SECURITY_QUESTIONNAIRE_RESPONSES.md](./SECURITY_QUESTIONNAIRE_RESPONSES.md), [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)
