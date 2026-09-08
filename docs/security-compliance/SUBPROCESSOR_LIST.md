# Subprocessor list

**Audience:** agency security, legal, and procurement reviewers.  
**Status:** **CURRENT** as of 2026-09-08 — review quarterly and before each major architecture change.  
**Not exhaustive** of every AWS API call; lists **categories of third parties** that may process customer data when features are enabled.

Rapid Cortex is primarily deployed on **Amazon Web Services (us-east-1** by default unless contract specifies otherwise). Customer data is scoped by **`agencyId`** tenant isolation.

This inventory is the AI / communications subprocessor documentation for Call Assist, mapping, STT, and analysis. It is **not** a CJIS certification.

---

## 1. Infrastructure (always on for hosted SaaS)

| Subprocessor | Purpose | Data categories | Region / notes |
|--------------|---------|-----------------|----------------|
| **Amazon Web Services** | Hosting: Lambda, API Gateway, DynamoDB, S3, Cognito, CloudWatch, CloudTrail (immutable Object Lock logs), Secrets Manager, SES, SNS, EventBridge, ECS/Fargate, CloudFront, Route 53, ACM, WAF (when enabled), Amazon Location Service | Account metadata, incident data, transcripts, audit logs, auth tokens (server-side), media objects, map tiles | Customer stack region; see [SECURITY_MODEL.md](./SECURITY_MODEL.md) |

---

## 2. AI and language (when enabled — default on most stacks)

| Subprocessor | Purpose | Data categories | Region / notes |
|--------------|---------|-----------------|----------------|
| **Amazon Bedrock** | Incident analysis, Call Assist intent fallback, triage, summarization | Transcript excerpts, incident metadata (minimized via `sanitizeForProvider`) | AWS region of Bedrock endpoint |
| **Amazon Lex V2** | Call Assist NLU / slot filling on Amazon Connect | Caller utterances, session attributes (agencyId, callId) | AWS |
| **Amazon Connect** | Live telephony (ANI, optional ALI attributes, media, queue transfer) | Call audio, ANI, contact attributes | AWS; RC does not operate a 911 SIP switch |
| **Amazon Transcribe** | Speech-to-text | Audio / stream metadata | AWS |
| **Amazon Translate** | Text translation | Transcript text | AWS |
| **Amazon Comprehend** | Language detection / NLP tiers | Transcript text | AWS |
| **Amazon Polly** | Call Assist / Connect TTS | Prompt text (no CAD payload) | AWS |

Optional (only if secret ARNs configured — **off** in CJIS-sensitive posture):

| Subprocessor | Purpose | Data categories |
|--------------|---------|-----------------|
| **OpenAI** | Alternate analysis provider | Prompts / transcripts per handler config |
| **Anthropic** | Alternate analysis provider | Prompts / transcripts per handler config |
| **Microsoft Azure** (Speech / Translator) | Alternate STT / translation | Audio / text per env |
| **Google Cloud** | Alternate STT / translation | Audio / text per service account |

Disable external keys by leaving ARNs unset — see [DEPLOYMENT_MULTILINGUAL_AWS.md](../deployment-infrastructure/DEPLOYMENT_MULTILINGUAL_AWS.md) and [CJIS_ALIGNMENT_NOTES.md](./CJIS_ALIGNMENT_NOTES.md). CJIS-sensitive tenants must stay on AWS-only AI (Bedrock / Lex / Transcribe / Translate) with provider allowlists.

Call Assist knowledge answers are grounded on the **agency knowledge base in DynamoDB** (`KB#` items). The model must not invent hours, fines, or medical advice without a knowledge hit (`assertGroundedReply` / `groundedKnowledgeReply`).

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
| 0.2 | 2026-09-08 | Current AI/comms inventory: Connect, Lex, Polly, Location Service, Bedrock minimization, Call Assist KB grounding |
| 0.1 | 2026-07-09 | Initial draft from `infra/template.yaml` and provider docs |

**Contact:** security review requests — use agency contract channel or `privacy@rapidcortex.us` for privacy-specific questions.

**Related:** [SECURITY_QUESTIONNAIRE_RESPONSES.md](./SECURITY_QUESTIONNAIRE_RESPONSES.md), [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)
