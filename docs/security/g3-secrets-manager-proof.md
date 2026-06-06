# G3 Evidence — AWS Secrets Manager & Server-Only Secrets

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — architecture documented; attachment of live ARNs/console exports is an **ops** task per environment.

## Loader implementation

Runtime resolution is implemented in:

- `apps/api/src/lib/runtimeSecrets.ts` — `resolvePlainOrSecretArn(plain, arn)` with in-memory TTL cache.
- `apps/api/src/security/server-secrets.ts` — curated list of ARN-style env knobs (documentation export).

## Representative secret-bearing parameters (infra)

Inspect `infra/template.yaml` for `AWS::SecretsManager::Secret`, multilingual secrets, JWT/webhook encryptors, and Lambda env mappings (e.g. `OPENAI_API_KEY_SECRET_ARN`, `ANTHROPIC_API_KEY_SECRET_ARN`, Twilio-compatible ARNs).

## Verify secret exists **without dumping value**

```bash
AWS_REGION=us-east-1 aws secretsmanager describe-secret \
  --secret-id REPLACE_WITH_SECRET_NAME_OR_ARN \
  --query '{Name:Name,ARN:ARN,RotationEnabled:RotationEnabled}' \
  --output table
```

## Local development

Prefer `.env.local` (untracked) for inline fallbacks documented in `.env.example` root / `apps/web/.env.example`. Never bake production secrets into the repo.

## Rotation notes

- Rotate webhook signing secrets in Square/Stripe dashboards; update Secrets Manager payloads; redeploy or await Lambda cold refresh for cached TTL expiry (`runtimeSecrets` cache ~5 minutes).
