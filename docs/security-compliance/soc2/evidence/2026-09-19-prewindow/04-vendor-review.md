# 4. Vendor / subprocessor review — 2026-09-19

**SOP:** [vendor-management.md](../../processes/vendor-management.md)  
**Reviewer:** Jeff Coleman  
**Inventory date going in:** 2026-09-08 (`SUBPROCESSOR_LIST.md` v0.2)  
**Evidence:** [secrets-inventory.json](../../../../evidence/soc2-evidence/2026-10/secrets-inventory.json) (36 names, no values)

## Findings

### Still required (always-on AWS)

Amazon Web Services (Lambda, API Gateway, DynamoDB, S3, Cognito, CloudWatch, CloudTrail, Secrets Manager, SES, SNS, EventBridge, ECS/Fargate, CloudFront, Route 53, ACM, WAF, Location Service, Bedrock/Lex/Connect/Transcribe/Translate/Comprehend/Polly when those features are on).

### Optional AI ARNs **present** on live (not CJIS-default)

These secrets exist; they process customer content **only if the corresponding feature/handler uses them**:

| Secret name | Subprocessor |
|-------------|--------------|
| `rapid-cortex/ai/openai` | OpenAI |
| `rapid-cortex/ai/anthropic` | Anthropic |
| `rapid-cortex/multilingual/azure-keys` | Microsoft Azure |
| `rapid-cortex/multilingual/google-service-account` | Google Cloud |

**Decision:** keep listed as optional. CJIS-sensitive tenants must leave these unused (AWS-only). Do not treat “secret exists in the shared account” as “every agency’s transcripts go to OpenAI.”

### Present on live, **missing from v0.2 list** — added in v0.3

| Secret / product | Subprocessor | Data | Notes |
|------------------|--------------|------|-------|
| `rapid-cortex/incident-media/twilio` | Twilio | Phone numbers, SMS/voice metadata, media links | Feature-gated incident media |
| `rapid-cortex/connect/ring-credentials` + per-account Ring secrets | Ring | Device/media (Ring Connect) | Already in §3; citizen token secrets are high-sensitivity — rotation on unlink |
| `rapid-cortex/connect/wyze-api-keys` | Wyze | Camera credentials when WyzeEnabled | Off unless SAM gate on |
| `rapid-cortex/connect/nest-consent-hmac-dev` | Google Nest SDM (when used) | OAuth/consent HMAC | Citizen path still needs Device Access; HMAC is RC-owned |
| Rapid IQ keys (Hunter, Apollo, Legiscan, OpenStates, RunSignUp, Outlook/Graph, Teams webhook) | See v0.3 §8 | **Prospect / GTM data**, not 911 transcripts | Separate category |
| `rapid-cortex/dev/call-assist/*` | Amazon Connect (already listed) | Webhook/CCP secrets | AWS |
| `rapid-cortex/external-api/jwt` + `encryption` | none (RC-owned keys) | API client tokens | Not a subprocessor |
| `rapid-cortex/*/billing/*` | Amazon SES (already listed) | SMTP | AWS |

### Removed

None.

### Rotation

None of the 36 secrets have `RotationEnabled=true`. Compensating: [secrets-rotation-sop.md](../../../../evidence/soc2-evidence/2026-10/secrets-rotation-sop.md). No rotation ticket closed this day.

## Result

**PASS** after publishing SUBPROCESSOR_LIST v0.3. Next review 2026-12.

Ledger: [vendor-review-log.md](../vendor-review-log.md)
