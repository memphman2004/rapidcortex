# G3 Evidence — Encryption in Transit / at Rest

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — defaults documented; account-level confirmations stay **YELLOW** until operators attach proofs.

## In transit

- API Gateway HTTPS endpoints terminate TLS (`TLS_1_2` on regional custom domains in SAM).
- Web application uses HTTPS in production deployments; CSP / HSTS toggles surfaced via `NEXT_PUBLIC_*` CSP enforcement flags (`apps/web/next.config.ts`).
- Sensitive cookies should carry `Secure`/`httpOnly` in production — verify via browser devtools capture during pilot dress rehearsal (**manual proof**).

## At rest

- DynamoDB SSE enabled by AWS default (`AWS Owned` keys) — elevate to CMK requirements per customer contractual addendum where applicable.
- S3 SSE-S3 or SSE-KMS depending on bucket policy attachments (inspect stack outputs post-deploy).
- Secrets Manager ciphertext uses AWS-managed KMS data keys by default.
- Template toggles (`EnableCloudTrail`, optional KMS ARN) support CJIS-aligned operations when turned on (**cost impact**).

## Commands

```bash
aws dynamodb describe-table --table-name REPLACE \
  --query '{Name:Table.TableName,SSE:Table.SSEDescription}'

aws s3api get-bucket-encryption --bucket REPLACE
```
