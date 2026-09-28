# Cybersecurity & CJIS response cover  
## KCPD RFP 2026-0010 — Bid Lines 16–17

**To:** Kansas City Missouri Police Department — Information Technology Support Unit  
**Re:** NexCort iQ Call Assist — CJIS-aligned controls and cybersecurity posture  
**ITSU contact (solicitation):** (816) 234-5286  

---

## Claim level (read first)

NexCort iQ documents **CJIS-aligned technical controls** for agency mapping.  
We do **not** claim FBI CJIS certification, CJIS-ATP, SOC 2 Type II, or FedRAMP authorization in this response.

Safe language follows [../README.md](../README.md) (forbidden-language list).

---

## How Lines 16–17 are met

| Solicitation ask | Response |
|------------------|----------|
| Meet CJIS Security Policy (aligned mapping) | [../cybersecurity-controls.md](../cybersecurity-controls.md) §1 + [CJIS_ALIGNMENT_NOTES.md](../../security-compliance/CJIS_ALIGNMENT_NOTES.md) |
| MFA | Cognito MFA required on production user pool (documented in cybersecurity pack) |
| Encrypt in transit | TLS 1.2+ (API Gateway / CloudFront / AWS service calls) |
| Encrypt at rest | DynamoDB / S3 encryption; KMS upgrade path per agency policy |
| Role-based permissions | Canonical roles + `AuthorizationService` + `agencyId` tenancy |
| Detailed audit logging | Audit repository + Call Assist audit event types |
| Annual penetration testing | Available as separate assessment SOW; process in cybersecurity pack §8 |
| Vulnerability scanning | CI / dependency / infra scanning process (see pack); Checkov evidence under `docs/evidence/vuln-scans/` is engineering evidence, not a substitute for a third-party pen-test report |
| Cybersecurity engagement | Offeror will coordinate with ITSU; named contacts in SOW |

---

## Attachments for Lines 16–17 (minimum zip)

1. This cover  
2. [../cybersecurity-controls.md](../cybersecurity-controls.md)  
3. [../implementation-and-transition.md](../implementation-and-transition.md) (DR / IR cross-refs)  
4. [SECURITY_QUESTIONNAIRE_RESPONSES.md](../../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md)  
5. [SUBPROCESSOR_LIST.md](../../security-compliance/SUBPROCESSOR_LIST.md)  
6. [soc2/README.md](../../security-compliance/soc2/README.md) — **policies / SOPs only**, not a Type II report  

Optional if ITSU requests: network access path diagram for this tenant; current pen-test PDF under NDA.

---

## CAD / AI data handling (Call Assist specific)

- CAD write-back remains **fail-closed** until a signed addendum and UAT.  
- Prefer AWS-native AI/STT/Translate for CJIS-sensitive tenants (external provider ARNs unset).  
- Call Assist session retention supports legal hold and Missouri Sunshine–oriented seed defaults; Department policy controls final retention.

---

## Post-award agency items

| Item | Owner |
|------|-------|
| CJIS Security Addendum execution | Agency + Offeror legal |
| Personnel screening / awareness for contractor access | Agency CSO path |
| Residual-risk acceptance for AI assistive use | Agency |
| Confirmation of AI provider allowlist for this tenant | Joint |

---

*Prepared for solicitation 2026-0010 Addendum 4 — 2026-09-27*
