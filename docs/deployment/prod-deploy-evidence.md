# Production deploy evidence — Rapid Cortex SAM (nested stacks)

Fill this document after each production deployment. Paste sanitized CLI output where noted; do not paste secret values.

## Deployment snapshot

| Field | Value |
|---|---|
| Deployment date/time (UTC) | _YYYY-MM-DDTHH:MMZ — fill after deploy_ |
| AWS account ID | _from `aws sts get-caller-identity`_ |
| Region | _e.g. us-east-1_ |
| Root stack name | _default `rapid-cortex-prod` unless overridden_ |
| Nested stacks updated | `DataLayerStack` (template `infra/nested/stack-data-layer.yaml`), `AppSamStack` (template `infra/nested/stack-app-sam.yaml`) |

## Commands used

**Preflight / template sizing**

```bash
./scripts/infra-template-size-check.sh
```

**Change set only (recommended before first prod apply)**

```bash
HTTP_API_CORS_ORIGINS=https://www.rapidcortex.us ./scripts/deploy.sh prod --changeset-only
```

**Full deploy**

```bash
HTTP_API_CORS_ORIGINS=https://www.rapidcortex.us ./scripts/deploy.sh prod
```

**Post-deploy verification**

```bash
npm run security:g3
npm run smoke:api
# Optional deeper pilot harness (requires env like API base URL — see scripts/pilot-smoke-test.ts):
# npm run pilot:smoke
```

## SAM / packaging

| Item | Evidence |
|---|---|
| `sam validate --lint infra/nested/stack-data-layer.yaml` | _PASS/FAIL + note_ |
| `sam validate --lint infra/nested/stack-app-sam.yaml` | _PASS/FAIL + note_ |
| `infra-template-size-check.sh` | _RESULT PASS/WARN/FAIL + largest built YAML bytes_ |
| Change set execution | _created / executed / rolled back — attach ARN or CLI tail_ |

## Configuration

| Item | Proof (no secrets) |
|---|---|
| `HTTP_API_CORS_ORIGINS` | _e.g. `https://www.rapidcortex.us` — comma-list, HTTPS only for prod_ |
| `HttpApiUrl` stack output | _paste output of `aws cloudformation describe-stacks`_ |
| CAD write-back | _confirm `CAD_WRITEBACK_ENABLED` / stack defaults keep write-back **disabled** for pilot/production policy_ |

## WAF attachment (manual)

Paste association proof (sanitized):

- Regional WebACL association for the HTTP API stage, or
- `aws wafv2 list-resources-for-web-acl --scope REGIONAL ...` excerpt

## Rollback

```bash
aws cloudformation cancel-update-stack --stack-name YOUR_ROOT_STACK_NAME --region YOUR_REGION
# OR delete change set without executing — prefer reviewing failed nested stack events first
aws cloudformation describe-stack-events --stack-name YOUR_ROOT_STACK_NAME --region YOUR_REGION
```

Document the exact failing nested stack logical ID under `FAILED` resources if rollback was required.

## Smoke tests

| Check | Command / expectation |
|---|---|
| Pilot smoke | `npm run smoke:pilot` — attach log |
| G3 automation | `npm run security:g3` — attach log (environment-specific; **does not close G3 by itself**) |

## Sign-off

Deployment execution does **not** close G3 (security controls evidence). Attach reviewer sign-offs per [`docs/customer-readiness-gate.md`](../customer-readiness-gate.md).
