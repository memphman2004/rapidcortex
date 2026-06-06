<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rapid Cortex — global feature standards

All new features must follow the always-on rule **`.cursor/rules/rapid-cortex-global-features.mdc`**: `agencyId` on every DynamoDB access; Zod from `packages/shared`; RBAC via `packages/security` at handler entry; audit events for meaningful state changes; full Lambda/route/env/IAM updates in `infra/template.yaml` with **no wildcard IAM** and **Secrets Manager ARNs** instead of raw secrets; UI behind `NEXT_PUBLIC_ENABLE_*`; mock/dev paths for external AWS/AI; run **`sam validate --lint`** after SAM edits.
