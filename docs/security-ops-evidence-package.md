# Security & Operations Evidence Package (Pilot Readiness)

This document supports **security and ops review** alongside the controlled read-only / shadow cadence. It intentionally describes **CJIS-aligned operational preparation**. It **does not** claim CJIS authorization, certification, or accreditation.

---

## 1. CORS Evidence

| Item | Repo / infra reference | Evidence / verification |
|---|---|---|
| Where CORS is configured | Inspect API Gateway HTTP API routes and Lambda authorizer wiring (`infra/template.yaml`, API handler behavior). Supplemental browser-side restrictions may exist in middleware or headers in `apps/web/`. | **Manual:** Export API Gateway Access-Control-Allow-Origin for production stage. Attach screenshot(s). |
| Allowed origins | Web app environment values (`NEXT_PUBLIC_SITE_URL`, `API_UPSTREAM_BASE`, Cognito OAuth redirect URIs in pool config — not duplicated here). | **Manual:** Paste exact allow-list documented in IaC/console. |
| No wildcard origins in prod | Confirmation required from deployed configuration. | **Manual:** Demonstrate wildcard is absent (`*` not used for credentialed routes). Provide test curl output. |

**Test command (placeholder)**

```bash
curl -si -H "Origin: https://REPLACE_WITH_CUSTOMER_ORIGIN" "https://REPLACE_WITH_API_EXECUTE_URL/api/health" | rg -n "access-control"
```

Attach console output covering production (or staging) stage.

---

## 2. WAF Evidence

| Item | Evidence / verification |
|---|---|
| Whether WAF is deployed | **Manual:** AWS WAF Console — Web ACL associations (CloudFront, API GW, Application Load Balancer). |
| Associated resource | Paste ARN / distribution ID (`REPLACE_ME`). |
| Managed rule groups | List managed rule sets (baseline AWSManagedRules..., IP reputation, rate-based rules). Attach JSON export. |
| Rate limiting rule | Paste rule priorities + limits. |
| Verification | **Manual:** `aws wafv2 get-web-acl --scope REGION --id REPLACE --name REPLACE` (sanitize output before sharing externally). |

---

## 3. Secrets Evidence

| Item | Repo / infra reference |
|---|---|
| Secrets storage pattern | Sensitive values fetched by Lambda from AWS Secrets Manager or SSM Parameter Store where applicable — confirm per-deployed stack outputs and function env bindings in `infra/template.yaml`. `.env*` files belong on developer machines only. |
| Confirmation secrets are not committed | Run `npm run security:scan-secrets` (see repo root scripts) and CI output. Paste latest clean run artifact. |

**Rotation plan (manual template)**

- Quarterly rotation for API keys tied to integrations.
- Incident-driven rotation upon suspected disclosure.
- Document owner approvals and ticket IDs externally.

Required environment variables (non-exhaustive): refer to `.env.example` (root / `apps/web/.env.example`) and deployment outputs from `infra/template.yaml`.

---

## 4. CloudWatch Alarms Evidence

Locate alarm blocks under the SAM application nested template `infra/nested/stack-app-sam.yaml` (and related nested resources deployed by the root stack `infra/template.yaml`). Example patterns include Lambda error alarms and operational topics (`OpsAlertsTopic`).

**Note:** Splitting infra into nested stacks avoids CloudFormation’s SAM **~1 MB** transformed-template deployment failure. That remediated **deployment**, not operational security closure — artifacts for CORS, WAF, secrets, and alarms must still come from **live environment** screenshots/CLI transcripts.

Provide console captures for:

| Alarm | Notes |
|---|---|
| API error spike | Thresholds tuned for pilot traffic; confirm dashboard link. |
| Lambda error | Tie to canonical function naming from CloudFormation deployment. |
| Lambda duration breach | Tune per cold-start envelopes. |
| DynamoDB throttle / capacity | Inspect table capacity mode (`PAY_PER_REQUEST` vs provisioned) and reconcile alarm metrics. |

**Manual:** Paste alarm names + SNS subscription confirmation.

---

## 5. Rollback Drill Evidence

| Item | Artifact |
|---|---|
| Deployment rollback command | Document exact pipeline / script used (`deploy:api`, `deploy-web:ssr`, etc.) with commit SHA pinning. |
| Last known-good reference | Paste git tag/commit + CloudFormation Stack last stable update timestamps. |
| Rollback checklist | DNS cutover, Lambda alias versions, DynamoDB sanity spot-check, smoke script (`tsx scripts/pilot-smoke-test.ts`). |
| Owner approval | Formal change ticket ID + approving role. |

---

## 6. Audit Logging Evidence

The shared audit vocabulary extends in code (`packages/security/src/audit-schema.ts`). Pilot-relevant instrumentation includes:

| Event type | Repo reference |
|---|---|
| Login success / failure | `AUDIT_EVENT_TYPES.LOGIN_*` handlers — verify via Dynamo query by type. |
| Incident access / mutate | Incident service writes — spot-check Dynamo rows. |
| CAD read previews | Structured JSON returned by staging adapter — server logs only unless persisted elsewhere. |
| CAD write-back blocked attempts | `cad.writeback.blocked` events via `/api/security/cad-writeback-blocked`. |
| Admin / supervisor dashboards | Routed through entitlement checks — corroborate with manual session capture. |

**Manual:** DynamoDB query examples for staging environment (sanitize PII externally).

---

## 7. Pilot Sign-Off Checklist

- Security review attachment ID: `REPLACE_ME`
- Ops review attachment ID: `REPLACE_ME`
- Agency admin acknowledgement: `REPLACE_ME`
- CAD write-back **disabled by policy** acknowledgment: ✅ required (controlled pilot posture)
- Read-only pilot scope approval: ✅ required before customer traffic

---

## 8. Public Status Page Evidence (Operational Readiness)

Status page evidence supports transparency and operations readiness. It is not a substitute for security certification, CJIS authorization, SOC 2 attestation, or full production readiness claims.

| Item | Required evidence |
|---|---|
| Public endpoint reachable | Screenshot or curl output for `https://status.rapidcortex.us` |
| Public API reachable | Curl output for `/api/status` from public host routing |
| No authentication requirement | Verify page/API load without Cognito session |
| Data safety | Verify payload excludes secrets, tokens, agency/customer/caller/transcript data |
| Monitoring source documented | Link to data source design/runbook for status and uptime |
| Incident comms process documented | Link to owner workflow and approval steps |

Current gate recommendation: **YELLOW** until DNS + production monitoring evidence are attached and approved.

---

**Disclaimer.** This artifact is procedural evidence scaffolding. Operational truth lives in deployed accounts, ticketing systems, and customer agreements.
