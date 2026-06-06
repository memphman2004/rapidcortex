# G3 Evidence — S3 Assets & IAM Least Privilege

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — bucket policies drafted in infra; tightening must be evidenced per-account.

## Assets bucket (`ASSETS_BUCKET`)

Defined in SAM (`infra/template.yaml`) — **Block Public Access required** (`PublicAccessBlockConfiguration` typical pattern). Incident media uploads use presigned PUT flows inside `apps/api/src/services/mediaService.ts` variants with agency/incident prefixes.

## Operational checks

```bash
aws s3api get-public-access-block --bucket REPLACE_BUCKET_NAME || true

aws iam get-role-policy \
  --role-name REPLACE_UPLOAD_ROLE_NAME \
  --policy-name REPLACE_POLICY_NAME
```

Attach least-privilege output for reviewer sign-off (**manual** artifact).

## File validation

MIME sniff + size clamps (`INCIDENT_MEDIA_MAX_UPLOAD_BYTES` env) — referenced in multilingual/media documentation; confirm agency-specific quotas before pilot uplift.
