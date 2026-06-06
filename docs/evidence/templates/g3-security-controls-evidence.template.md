# G3: Security controls (platform) — evidence template

**Date:** _YYYY-MM-DD_  
**Environment:** _target deployment under assessment_

> **Principle:** G3 is **not** GREEN from main-branch code or local Vitest alone. It requires **environment-specific** PASS evidence and reviewer sign-off (`docs/security/g3-security-controls-platform.md`).

## Repo / scripted checks (supporting only)

- `./scripts/security-g3-validation.sh`
- `npm run security:g3` with `BASE_URL`, optional `TEST_JWT`, `G3_WEB_URL`, CORS origins.

## Required attachments for GREEN

- [ ] Secrets Manager inventory (names only; no values).
- [ ] WAF WebACL association to the correct API / CloudFront distribution.
- [ ] CORS approved vs rejected origin probes (logs or HAR).
- [ ] Encryption at rest / in transit verification for the target account.
- [ ] Webhook signature valid / invalid / missing matrix (Square + others in scope).

## Sign-offs

- [ ] Security lead — date: ___
- [ ] DevOps / platform lead — date: ___
- [ ] Compliance (if CJI = YES) — date: ___

**Gate status:** _YELLOW until the checklist above is complete in the target environment._
