# Customer Readiness Gate Sheet (One Page)

**Project:** Rapid Cortex  
**Audience:** Customer readiness meeting (Product, Engineering, Security, Operations, Agency IT)  
**Current Program Position:** **Conditional No-Go** for production CAD write integration

## Positioning and customer language

**Pilot position:** Rapid Cortex is a **read-only operational intelligence layer** that augments existing CAD workflows without modifying CAD records.

**Customer communication statement:**  
"Initial deployment will run in read-only/shadow mode. Rapid Cortex will monitor, summarize, translate, and support operational visibility without writing back into CAD. CAD write-back will only be considered after joint validation, approval workflows, rollback procedures, audit evidence, and customer sign-off are complete."

## Gate status legend

- **Green (Go):** Control is fully implemented, tested, and evidenced.
- **Yellow (Conditional Go):** Control is partially complete; pilot can proceed only within explicitly limited read-only scope.
- **Red (No-Go):** Control is missing or unverified; do not proceed.

## Program-level decision (current)

- **Production CAD write-back:** **Red (No-Go)**
- **First customer read-only/shadow pilot:** **Yellow (Conditional Go)**

## P0 gates (must pass for pilot)

| Gate | Current | Owner | Exact acceptance tests | Evidence path |
|---|---|---|---|---|
| Tenant isolation and auth | Yellow | Security + Backend | 1) Protected routes reject missing/invalid JWT (`401/403`). 2) Cross-agency access attempts fail with `403`. 3) `custom:agencyId` and role claims validated for pilot accounts. | `docs/security-compliance/TENANT_ISOLATION_MODEL.md`; staging test logs in `docs/deployment-infrastructure/PILOT_READINESS_RUN_RESULTS.md` |
| CAD read adapter (one real vendor) | Yellow | Integrations + Backend | 1) One vendor-specific CAD read adapter ingests real test feed/events end-to-end. 2) Timeout, auth-failure, malformed payload, and retry paths pass. 3) Data mapping checks pass against expected incident fields. | Adapter implementation in `packages/integrations/src/`; evidence and run notes in `docs/product-architecture/CAD_CONNECTION_PLAYBOOK.md` and `docs/deployment-infrastructure/PILOT_READINESS_RUN_RESULTS.md` |
| Hard write-back disablement | Yellow | Integrations + Security | 1) CAD write routes are blocked in production and pilot by hard feature flag. 2) Attempted write returns explicit blocked/not-configured response. 3) Feature flag state is auditable. | `docs/product-architecture/CAD_CONNECTION_PLAYBOOK.md`; config evidence in deployment records under `docs/deployment-infrastructure/` |
| Pilot-path API completeness | Yellow | Web + API | 1) Replace `notConfigured` stubs that are on pilot path (auth, ingestion, read surfaces, admin status). 2) Pilot smoke tests pass without placeholder failures. | `docs/deployment-infrastructure/PILOT_READINESS_CHECKLIST.md`; smoke artifacts in `docs/deployment-infrastructure/PILOT_READINESS_RUN_RESULTS.md` |
| Audit logging and traceability | Yellow | Backend + Security | 1) Audit events emitted for auth events, CAD reads, integration state changes, and operator actions. 2) Request ID correlation works across API logs and audit records. 3) Retention/export workflow tested. | `docs/security-compliance/PRODUCTION_SECURITY_CHECKLIST.md`; `docs/security-compliance/PRODUCTION_READINESS_AUDIT.md`; run evidence in `docs/deployment-infrastructure/PILOT_READINESS_RUN_RESULTS.md` |
| Alarms, fail-safe behavior, and rollback | Yellow | SRE/Platform + Operations | 1) Alarms fire for integration failures/timeouts. 2) Fail-safe mode keeps CAD untouched and preserves core operations. 3) Rollback/kill-switch drill completed in staging. | `docs/operations-runbooks/RUNBOOK.md`; `docs/operations-runbooks/INCIDENT_RESPONSE_RUNBOOK.md`; alarm and drill evidence in `docs/deployment-infrastructure/PILOT_READINESS_RUN_RESULTS.md` |
| Security controls (CORS, WAF, secrets) | Yellow | Security + Platform | 1) CORS allowlist limited to approved origins. 2) WAF attached and rules enabled for pilot stack. 3) Secrets sourced from managed secret stores; no plaintext secrets in env/config. | `docs/deployment-infrastructure/PILOT_AWS_DEFENSE.md`; `docs/deployment-infrastructure/ENVIRONMENT_READINESS_CHECKLIST.md`; `docs/security-compliance/PRODUCTION_SECURITY_CHECKLIST.md` |

## P1 gates (required before broad rollout)

| Gate | Current | Owner | Exact acceptance tests | Evidence path |
|---|---|---|---|---|
| Desktop connector hardening | Yellow | Desktop + Security | 1) Signed/notarized desktop build path verified. 2) Token lifecycle hardening validated. 3) Installer/update workflow tested with rollback notes. | `docs/desktop/DESKTOP_CONNECTION_AUDIT.md`; `docs/desktop/DESKTOP_CLIENT_BACKEND_INTEGRATION.md` |
| Customer ops workflow readiness | Yellow | Operations + Customer Success | 1) On-call and escalation matrix approved. 2) Agency onboarding/training complete. 3) Weekly review cadence and incident comms template in place. | `docs/operations-runbooks/OPS_CONTACT_MATRIX.md`; `docs/operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md`; `docs/go-to-market-sales/PILOT_REVIEW_TEMPLATE.md` |
| Governance for future write-back | Red | Product + Legal + Security | 1) Joint approval workflow defined. 2) Idempotency/replay protection controls tested. 3) Dual authorization and customer sign-off process approved. | `docs/product-architecture/INTEGRATIONS_CAD_AND_MOTOROLA.md`; `docs/go-to-market-sales/SALES_BOUNDARIES.md` |

## Exit criteria: read-only pilot -> controlled write-back

All items below must be **Green** with evidence attached before enabling any write-back path:

1. One real vendor CAD read adapter has completed pilot burn-in with no unresolved P0 defects.
2. Tenant isolation tests pass for all pilot agencies and role tiers (`custom:agencyId`, RBAC checks, and negative-path tests).
3. Write-back workflow is implemented with explicit human approval gates, idempotency, replay protection, and full audit trail.
4. Rollback/kill-switch drills are successful and repeatable, with documented RTO/RPO targets for integration disablement.
5. Security evidence package is complete (CORS allowlist, WAF policy, secret management posture, alarm coverage, smoke test results).
6. Desktop hardening is complete for intended deployment channel (if desktop is in customer path).
7. Customer and vendor sign-off is documented for scope, change control, and operational ownership.

## Decision rubric for each meeting

- If any P0 gate is **Red** -> **No-Go**.
- If all P0 gates are **Yellow/Green** and scope remains read-only -> **Conditional Go** for pilot.
- If all P0 and required P1 gates are **Green** and write-back exit criteria are complete -> **Go** for controlled write-back.
