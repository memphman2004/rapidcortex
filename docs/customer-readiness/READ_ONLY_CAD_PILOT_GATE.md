# Rapid Cortex Customer Readiness Gate Sheet

## First Read-Only CAD Pilot

## 1) Executive Verdict

- **Production CAD write-back:** **NO-GO**
- **Read-only/shadow customer pilot:** **GO with controls**
- **Scope:** one customer, one CAD vendor adapter, staging validation before production pilot

## 2) Pilot Positioning

"Rapid Cortex will run as a read-only operational intelligence layer that augments the customer's existing CAD workflow without modifying CAD records."

## 3) Gate Summary Table

| Area | Status (Green / Yellow / Red) | Current Evidence | Gap | Required Action | Owner | Acceptance Test | Exit Criteria |
|---|---|---|---|---|---|---|---|
| CAD read adapter | Yellow | Adapter interfaces and read-only scaffolding exist | Real vendor adapter is not complete end-to-end | Implement one real vendor read adapter and validate in staging | Integrations + Backend | Read operations succeed against vendor sandbox/test endpoint | End-to-end read flow passes staging + pilot checks |
| CAD write-back | Red | Write path is intentionally disabled/placeholder | No approved write path | Keep hard-disabled behind feature flag | Integrations + Security | Write attempts return disabled/not configured | Remains disabled for this pilot phase |
| Authentication and tenancy | Yellow | JWT/Cognito auth and agency role model present | Customer-like role/agency isolation needs full staging evidence | Execute role + `agencyId` isolation test pack | Security + Backend | Cross-agency access attempts fail with `403` | Isolation tests pass for pilot accounts |
| External API platform | Yellow | External API framework exists with dispatcher/routing patterns | Pilot-critical path still includes some partial/stubbed routes | Replace pilot-path stubs and validate live route behavior | API Team | Pilot flows complete without `notConfigured` failures | Pilot API smoke tests pass end-to-end |
| Audit logging | Yellow | Audit services and repositories exist | Full pilot action coverage evidence not complete | Verify audit events for auth, CAD reads, and operator actions | Backend + Security | Each pilot scenario emits expected audit events | Audit evidence package complete and reviewable |
| Secrets management | Yellow | Secret management patterns exist | Need stack-level verification for pilot deployment | Validate no secrets in code/front-end env, confirm managed secret sources | Security + Platform | Secret scan + config review passes | Security sign-off for secrets posture |
| WAF/CORS/security controls | Yellow | Infrastructure supports WAF/CORS controls | Environment-specific evidence and final checks pending | Confirm approved origins, WAF enabled, and policy documented | Security + Platform | CORS allows only approved origins; WAF attached | Security checklist complete for pilot stack |
| Alarms and monitoring | Yellow | Monitoring/alarm scaffolding and runbooks exist | Alarm coverage and trigger evidence incomplete | Configure and test CAD/API failure alarms | SRE/Platform | Simulated failures trigger expected alerts | On-call receives and acknowledges alerts |
| Retry and failure behavior | Yellow | Retry/error handling patterns exist in platform | Vendor adapter retry semantics not fully validated | Implement bounded retries and safe failure behavior | Integrations + Backend | Transient failures retry; hard failures fail safe | Failure behavior documented and tested |
| Desktop connector | Yellow | Desktop connector/auth flows exist | Broad rollout hardening remains | Complete hardening tasks before wider deployment | Desktop + Security | Desktop pilot path passes auth/session stability checks | Desktop hardening gates signed off |
| Customer training | Yellow | Training/runbook docs exist | Pilot-specific training completion evidence pending | Deliver dispatcher/admin training for pilot scope | Customer Success + Ops | Training attendance + competency checklist complete | Customer training sign-off captured |
| Rollback/fail-safe process | Yellow | Operational runbooks and kill-switch concept exist | Drill evidence and timings need capture | Execute rollback/fail-safe drill in staging | Ops + Platform | Drill demonstrates controlled disablement | Drill report and approvals filed |
| Support escalation path | Yellow | Escalation docs and support model exist | Named contacts and SLA acknowledgment may be incomplete | Finalize support contacts, severity routing, and comms cadence | Ops + Customer Success | Test escalation scenario reaches correct owner | Support escalation matrix approved |

## 4) Green / Yellow / Red Definitions

- **Green:** Ready for pilot use with evidence captured.
- **Yellow:** Allowed for read-only pilot with documented limitation and mitigation.
- **Red:** Blocked from production or disabled by feature flag.

## 5) Top Blockers

- Real CAD vendor adapter not implemented end-to-end.
- CAD write path is placeholder/disabled.
- Several API areas still rely on `notConfigured` stubs.
- Deployment governance blockers remain open.
- Desktop app is not fully hardened for broad customer rollout.

## 6) Read-Only Pilot Acceptance Tests

- Customer user can log in with correct role.
- Customer user cannot access another agency's data.
- CAD read adapter authenticates successfully.
- CAD read adapter handles API errors safely.
- CAD read adapter retries transient failures.
- No CAD write operation can execute.
- CAD write endpoints return disabled/not configured response.
- All pilot actions create audit log events.
- Alarms trigger on failed CAD/API calls.
- Secrets are not stored in code or frontend env.
- CORS only allows approved origins.
- Manual mode/fail-safe behavior is documented.
- Smoke test passes after deployment.

## 7) Requirements Before CAD Write-Back Can Be Enabled

- Written customer approval.
- Vendor-specific write adapter implemented.
- Field mapping approved by customer.
- Dispatcher/supervisor review workflow.
- Rollback procedure.
- Duplicate prevention.
- Idempotency keys.
- Error handling and retry policy.
- Audit trail for every write attempt.
- Feature flag per agency.
- Staging sign-off.
- Production smoke test.
- Security review.
- Incident response plan.

## 8) Customer Meeting Script

"Rapid Cortex is ready for a controlled read-only pilot. We are intentionally keeping CAD write-back disabled during the first phase to protect the customer's live CAD environment. This allows the agency to validate AI summaries, transcription, translation, operational visibility, audit logs, and workflow fit without changing CAD records. Write-back will only be considered after all technical, operational, and approval gates are met."

## 9) Final Recommendation

- Proceed with one-customer read-only pilot only.
- Do not enable CAD write-back.
- Implement one real CAD read adapter.
- Capture evidence.
- Reassess after pilot exit criteria are met.
