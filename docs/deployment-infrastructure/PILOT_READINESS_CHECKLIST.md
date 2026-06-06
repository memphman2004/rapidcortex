# Pilot readiness checklist — controlled first-agency launch

Use this checklist before declaring the product **pilot-ready** for a real agency evaluation. It implements **Phase 1 — product / governance** together with technical gates. Governance sources: [MVP_SCOPE.md](./MVP_SCOPE.md), [NON_GOALS.md](./NON_GOALS.md), [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md), [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md), [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md).

Copy [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md) per agency and attach SOW references.

---

## Controlled pilot boundary

A **controlled pilot** is **not** general availability. The following boundaries apply unless explicitly waived in writing:

- **CAD:** Pilot may use **read-only** CAD, **no** CAD integration, or a **vendor-specific** adapter per [CAD_CONNECTION_PLAYBOOK.md](./CAD_CONNECTION_PLAYBOOK.md) and [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md). Rapid Cortex **enhances** CAD; it **does not replace CAD**.
- **Sandbox / demo behavior:** Allowed **only** if **clearly labeled** in the UI and **acknowledged** by the agency (see [NON_GOALS.md](./NON_GOALS.md) §5, [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).
- **AI:** Output is **decision support** only; **manual dispatcher/supervisor review** is required ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md), [MVP_SCOPE.md](./MVP_SCOPE.md)).
- **Known limitations:** Agency acknowledges [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) and [NON_GOALS.md](./NON_GOALS.md) as part of onboarding.
- **Operations:** **Monitoring**, **support contacts**, and a **rollback path** are assigned before floor use ([RUNBOOK.md](./RUNBOOK.md), [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md)).
- **Exit:** **Pilot exit criteria** (success, extend, or stop) are documented and approved ([PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md), [phase-0/risk-register.md](./phase-0/risk-register.md)).

### Controlled pilot — governance and operations checklist

- [ ] **SOW / pilot agreement** complete (assistive use, not autonomous dispatch).
- [ ] **Security review** owner named and review scheduled or complete.
- [ ] **DPA / privacy** owner named and terms signed or in legal review.
- [ ] **Agency roles** and **`custom:agencyId`** verified for every user.
- [ ] **Retention policy** acknowledged ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).
- [ ] **Risk register** created or updated for the pilot window.
- [ ] **Training** scheduled / completed for dispatch, supervisors, and admins.
- [ ] **Agency playbook** reviewed ([AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md)).
- [ ] **Weekly review cadence** scheduled (product + agency).
- [ ] **Support contact** assigned (hours, escalation).
- [ ] **Rollback path** reviewed with platform owner.
- [ ] **Pilot exit criteria** approved by agency and vendor (if applicable).

---

## 1. Product and governance

- [ ] Agency pilot **SOW / agreement** covers **assistive** use, not autonomous dispatch ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).
- [ ] Stakeholders acknowledged [MVP_SCOPE.md](./MVP_SCOPE.md) and [NON_GOALS.md](./NON_GOALS.md) (no implied GA or certification claims).
- [ ] **Roles** and **`custom:agencyId`** assigned for every user ([COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md) if self-signup).
- [ ] **Assistive AI** and **human-in-the-loop** rules communicated to dispatch and supervision ([USER_GUIDE.md](./USER_GUIDE.md)).
- [ ] **Protocol review** process agreed for any pack shown as protocol guidance ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).
- [ ] **Privacy / retention** decisions documented and signed where required ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).
- [ ] Agency completed [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md) (URLs, contacts, escalation, SOP pointers).

## 2. Environments and deployment

- [ ] **dev / staging / prod** (or **pilot**) stacks deployed — **or** a **single** stack with [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md) completed for that host at the intended readiness tier ([DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md)) ([AWS_SETUP.md](./AWS_SETUP.md), [DEPLOYMENT.md](./DEPLOYMENT.md), [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)).
- [ ] **CORS** `HttpApiCorsAllowedOrigins` matches real web origins (not `*` in production).
- [ ] **Secrets** configured (managed multilingual secrets, optional OpenAI/Anthropic ARNs).
- [ ] **`REVISION` or `GIT_SHA`** on Lambdas where traceability is required ([RUNBOOK.md](./RUNBOOK.md)).

## 3. Core application

- [ ] Next.js **API connected** for production pilot (`NEXT_PUBLIC_AUTH_PROXY` + `API_UPSTREAM_BASE` recommended).
- [ ] **No reliance on mock incidents** for live operations (`NEXT_PUBLIC_OFFLINE_DEMO_MODE` not set to `1` on pilot web hosts; see [NON_GOALS.md](./NON_GOALS.md) §5).
- [ ] Smoke: [RUNBOOK.md](./RUNBOOK.md) + `./scripts/post-deploy-smoke.sh` (or equivalent) green on staging.

## 4. AI analysis (production mode)

- [ ] Staging/prod **not** mock-only unless `AI_ALLOW_MOCK_ONLY_IN_PROD=true` is explicit policy ([INSTALLATION.md](./INSTALLATION.md)).
- [ ] Provider IAM or secrets validated for the target stage.

## 5. Multilingual voice (production mode)

- [ ] `LANGUAGE_SESSIONS_TABLE` and related config; strict validation passes ([DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)).
- [ ] Admin → Integrations: **0** multilingual config issues (`GET /api/integration/status`).

## 6. Security and audit

- [ ] `ALLOW_UNAUTHENTICATED_API=false` (or equivalent production posture).
- [ ] **Audit** route exercised; sampling plan for pilot volume.

## 7. Monitoring and reliability

- [ ] CloudWatch alarms reviewed; SNS/on-call wired ([infra/monitoring-and-ops.md](../infra/monitoring-and-ops.md)).
- [ ] On-call knows **health** URL and analyze / audio-chunk alarm semantics.

## 8. Quality and verification

- [ ] `npm run build` and `sam validate` (or CI equivalent) on release candidate.
- [ ] Staging **pilot test script** or checklist executed before prod cut.

## 9. Admin and support

- [ ] [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md) / [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md) in progress or complete with named owners.
- [ ] Agency admins walked through in-app **Admin → Pilot hub** (`/admin/pilot`) and [GTM_PACKAGE.md](./GTM_PACKAGE.md) / [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md).
- [ ] [training/PILOT_AGENCY_ADMIN_CHECKLIST.md](./training/PILOT_AGENCY_ADMIN_CHECKLIST.md) completed.
- [ ] [training/PILOT_DISPATCHER_CHECKLIST.md](./training/PILOT_DISPATCHER_CHECKLIST.md) completed.

## 10. Launch and training

- [ ] [USER_GUIDE.md](./USER_GUIDE.md) distributed with **agency-specific** URL and environment labels.
- [ ] Risk register reviewed for pilot window ([phase-0/risk-register.md](./phase-0/risk-register.md)).

---

**Live integration status** (authenticated): `GET /api/integration/status` — Admin → Integrations when the browser deployment is API-connected.

**Run log template:** [PILOT_READINESS_RUN_RESULTS.md](./PILOT_READINESS_RUN_RESULTS.md) — record PASS/FAIL per line with evidence. **AWS defense (WAF, SNS, CORS, Cognito URIs):** [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md). **Transcript retention policy + env:** [TRANSCRIPT_RETENTION_POLICY.md](./TRANSCRIPT_RETENTION_POLICY.md). **Readiness tiers + blockers:** [DEPLOYMENT_READINESS_MAP.md](./DEPLOYMENT_READINESS_MAP.md), [NEXT_DEPLOY_BLOCKERS.md](./NEXT_DEPLOY_BLOCKERS.md), [ENVIRONMENT_READINESS_CHECKLIST.md](./ENVIRONMENT_READINESS_CHECKLIST.md).
