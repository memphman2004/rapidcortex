# Implementation and transition (RFP)

**Scope:** Introducing Rapid Cortex as an **assistive** co-pilot beside existing CAD, 911, and radio. Rapid Cortex is never the system of record for dispatch.  
**How to use:** copy §1 into the agency workbook and fill names/dates. Linked checklists are the working procedures.

Index: [README.md](./README.md). Onboarding: [AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md). Workbook: [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](../go-to-market-sales/IMPLEMENTATION_WORKBOOK_TEMPLATE.md).

---

## 1. Detailed implementation schedule

Standard **12-week** first-agency (or first-PSAP) plan. Compress to 8 weeks only if Cognito, privacy sign-off, and a single jurisdiction are already done. Expand if CAD vendor work or CJIS-sensitive AI mode is in the SOW.

| Week | Phase | Rapid Cortex | Agency | Exit criteria |
|------|-------|--------------|--------|---------------|
| **1** | Kickoff & governance | Assign RC pilot lead; deliver this pack + workbook | Name sponsor, IT/security, floor supervisor, training lead | Signed assistive SOW; [PILOT_KICKOFF_CHECKLIST.md](../go-to-market-sales/PILOT_KICKOFF_CHECKLIST.md) started |
| **2** | Privacy, retention, protocols | Confirm AI/STT providers for this tenant | Privacy/retention decision; protocol pack owner | Checkpoints in workbook §4 dated |
| **3** | Tenant & identity | Agency row; Cognito app client / CORS / callback URLs | MFA policy; who may be `agencyadmin` | Test admin can sign in on the agreed URL |
| **4** | Environment ready | Confirm API + web stage; secrets ARNs; `CAD_WRITEBACK` remains **off** unless contracted | Network allowlist of Rapid Cortex HTTPS if required | [PILOT_VALIDATION_CHECKLIST.md](../go-to-market-sales/PILOT_VALIDATION_CHECKLIST.md) pre-flight green |
| **5** | Provisioning | Help create dispatcher / supervisor / admin users | Role mapping table approved | Each role reaches the correct home dashboard |
| **6** | Technical smoke | Post-deploy + authenticated smoke; tenant isolation spot-check | Two test accounts if possible | Smoke scripts pass; no cross-agency data |
| **7** | Training | Deliver dispatcher / supervisor / admin sessions | Staff attend; `/demo` only for scripted drills | [TRAINING_QUICKSTART.md](../operations-runbooks/TRAINING_QUICKSTART.md) complete |
| **8** | Supervised floor use | On-site or remote floor support window | Use on live calls **alongside** CAD; no CAD replacement | First live exercise logged |
| **9** | Tuning | Adjust alarms, language scope, protocol pack | Feedback in [PILOT_REVIEW_TEMPLATE.md](../go-to-market-sales/PILOT_REVIEW_TEMPLATE.md) | Known issues filed; KNOWN_LIMITATIONS updated if needed |
| **10** | Acceptance | Run §5 UAT with agency witness | Sign acceptance or punch-list | Signed UAT or dated punch-list with owners |
| **11** | Transition | Shift to standard support path | Agency L1 desk briefed | [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md) contacts filled |
| **12** | Hypercare close | Restore drill scheduled; IR tabletop optional | Sponsor retro | Hypercare ends; production support cadence |

**Not on this critical path unless the SOW says so:** bidirectional CAD, radio ingest, CJIS-sensitive external-AI lockdown, 24/7 support upgrade, SIEM connector.

Fill the same weeks into [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](../go-to-market-sales/IMPLEMENTATION_WORKBOOK_TEMPLATE.md) §7. Slippage: change-freeze weeks requested by the agency move training/go-live, not identity work.

---

## 2. Cutover strategy

There is **no** cutover that turns off CAD, CPE, or radio. Cutover means Rapid Cortex becomes **available on the floor** under change control.

### Pattern (required)

**Parallel operations.** Dispatchers keep CAD as system of record. Rapid Cortex provides transcript, translation, analysis, and QA **for human review**.

| Gate | Must be true before floor use |
|------|-------------------------------|
| G0 | SOW states assistive use; CAD write-back **disabled** in API and web unless a signed CAD addendum exists |
| G1 | Pre-flight validation checklist passed |
| G2 | At least one `agencyadmin`, one `supervisor`, and N dispatchers (per SOW) can sign in |
| G3 | Floor fallback briefed: if Rapid Cortex is down, work CAD/radio as today |
| G4 | Ops SNS subscription live so RC sees 5xx/auth failures |

### Cutover steps (go-live window)

1. Confirm last known-good API + web release tags.  
2. Freeze unrelated deploys for the window.  
3. Re-run `scripts/post-deploy-smoke.sh` and health check.  
4. Enable user access (Cognito groups / status `active`) for the named pilot cohort — not the entire agency on day one.  
5. Floor supervisor announces “assistive only — CAD remains source of truth.”  
6. RC support on bridge for the first live block (length per SOW, typically 2–4 hours).  
7. End of window: go / no-go (continue cohort, pause access, or roll back access only).

### CAD-specific cutover

Read-only or write-back CAD is a **separate vendor project**. Do not schedule it on week 8 of a standard pilot. See [CAD_CONNECTION_PLAYBOOK.md](../product-architecture/CAD_CONNECTION_PLAYBOOK.md) and [READ_ONLY_CAD_PILOT_GATE.md](../customer-readiness/READ_ONLY_CAD_PILOT_GATE.md).

### Expand later

New jurisdiction or role class: repeat G1–G4; do not assume the first cohort’s training covers a new site.

---

## 3. Rollback procedures

Rollback is **access and application**, then **data** only if required.

### A. Abort go-live (no data restore)

1. Set pilot users `custom:status` inactive (or remove from the app client) so the floor returns to CAD-only.  
2. Leave stacks in place; do not delete DynamoDB (DeletionPolicy Retain).  
3. Notify sponsor: Rapid Cortex is paused, 911/CAD unchanged.

### B. Bad application deploy

| Layer | Action | Target time (ops, not SLA) |
|-------|--------|----------------------------|
| Failed CloudFormation | Let `ROLLBACK_COMPLETE` finish; fix; redeploy | Event-driven |
| Bad successful API | Redeploy previous SAM package / git tag | ≤ 30 minutes |
| Bad web | Previous ECS task definition; invalidate CloudFront | ≤ 60 minutes |
| Feature | Disable flag (e.g. keep `CAD_WRITEBACK_ENABLED` false) | Immediate |

Details: [RUNBOOK.md](../operations-runbooks/RUNBOOK.md) § Deploy and rollback.

### C. Data rollback

Application rollback **does not** undo DynamoDB writes.

1. Identify PITR timestamp (UTC).  
2. Restore **to new tables**; never rename production tables in place.  
3. Validate counts and sample incidents.  
4. Cut application env to restored tables under change control — or copy selected items back.

Full drill: [BACKUP_AND_RECOVERY.md](../operations-runbooks/BACKUP_AND_RECOVERY.md).

### D. Decision tree

```
Is CAD/911 impacted? → No (Rapid Cortex is assistive). Continue CAD.
Is Rapid Cortex wrong/unsafe on the floor? → Pause user access (A).
Is a new release broken? → App rollback (B).
Is tenant data corrupted? → PITR (C) with counsel if CJI-like content.
```

---

## 4. Testing methodology

| Layer | Tooling | When | Pass rule |
|-------|---------|------|-----------|
| Unit | Vitest (`npm test`) | Every merge candidate | Existing + new tests green |
| Handler / authz | Vitest handler tests | Every merge candidate | Wrong roles get **403**, not only happy-path 200 |
| Tenant isolation | Cross-tenant denial tests | Every merge candidate | No cross-`agencyId` read/write |
| Build | `npm run build` / typecheck | Every merge candidate | Compile clean |
| IAM | `scripts/validate-iam-policies.sh` / `validate:iam` | Template changes | Policy size and structure gates |
| Post-deploy smoke | `scripts/post-deploy-smoke.sh` | After every API deploy | Health 200; `/api/me` 401 anonymous |
| Authenticated smoke | Same script + `SMOKE_TEST_*` | Before floor use | `/api/me` 200 |
| Synthetic | `scripts/synthetic-api-health.sh` | Scheduled in ops | `status=ok` |
| Load probe | `scripts/pilot-load-smoke.sh` | Optional same week as go-live | No sustained 5xx |
| Security headers / CSRF | Web tests + `scripts/test-csrf-validation.sh` | Before production web | CSRF/origin behavior as documented |

Canonical: [TEST_STRATEGY.md](../product-architecture/TEST_STRATEGY.md).

**Not in default methodology:** Playwright E2E against the live floor; live Bedrock/OpenAI in CI (keys must not live in the repo). Those are manual or operator-CI jobs.

**Mocks:** Bedrock, STT, payments, and similar have mock/dry-run paths so CI does not need live credentials.

---

## 5. Acceptance testing procedures

Witnessed UAT uses the validation checklist plus the scenarios below. Agency sponsor (or delegate) initials each block. Failures become a punch-list with owner and date — they do not silently pass.

### 5.1 Environment

- [ ] Stack outputs recorded (API URL, User Pool, Ops SNS, dashboard name)  
- [ ] CORS matches real origins (`*` forbidden)  
- [ ] `NEXT_PUBLIC_OFFLINE_DEMO_MODE` unset on the pilot host  
- [ ] CAD write-back env **false** unless addendum signed  
- [ ] Post-deploy smoke **pass**

### 5.2 Identity and tenancy

- [ ] Dispatcher lands on jurisdiction dashboard; supervisor on supervisor; agency admin **not** on live dispatcher workspace  
- [ ] User from agency A cannot open agency B incident  
- [ ] Inactive user cannot call API  
- [ ] MFA challenge works if agency policy requires it  

### 5.3 Core assistive workflow

- [ ] Create incident  
- [ ] Append transcript; UI updates  
- [ ] Analyze returns structured result **or** a documented error (no silent fake success)  
- [ ] Dispatcher can dismiss/acknowledge; AI is not auto-dispatch  
- [ ] Admin integrations page loads; audit shows the test actions  

### 5.4 Multilingual (only if in SOW)

- [ ] Language session start; audio chunk or text path  
- [ ] Strict validation fails closed on bad config (`MULTILINGUAL_CONFIG_INVALID` visible)  

### 5.5 Operations

- [ ] CloudWatch dashboard opens  
- [ ] Test alarm or confirmed SNS subscription  
- [ ] Team can name last known-good git tag  
- [ ] Floor fallback (CAD-only) is written in the playbook  

### 5.6 Acceptance decision

| Result | Meaning |
|--------|---------|
| **Accept** | All required (in-SOW) blocks initialed; punch-list empty or only SEV-3 items dated |
| **Accept with punch-list** | Floor use continues; open items owned |
| **Reject** | Pause access (rollback A); re-test after fix |

Sign-off lines: reuse [PILOT_VALIDATION_CHECKLIST.md](../go-to-market-sales/PILOT_VALIDATION_CHECKLIST.md) Sign-off plus this UAT date.

Customer readiness gates (G1–G5) remain [customer-readiness-gate.md](../customer-readiness-gate.md) for internal RC — do not mark GREEN from docs alone.

---

## 6. Transition support

| Window | Rapid Cortex | Agency |
|--------|--------------|--------|
| **Implementation (weeks 1–10)** | Named pilot lead; scheduled training; technical smoke | Staff time; IT for Cognito/MFA |
| **Hypercare (weeks 8–12, overlapping floor use)** | Bridge during first live blocks; 30-minute SEV-1 updates | Floor supervisor is first contact for “how do I…” |
| **Steady state** | [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md) L2/L3 | L1: URL, role, reproduce, `requestId` |

**Handoff artifacts**

- Filled [OPS_CONTACT_MATRIX.md](../operations-runbooks/OPS_CONTACT_MATRIX.md)  
- [JURISDICTION_OPERATIONS_GUIDE.md](../admin-user-management/JURISDICTION_OPERATIONS_GUIDE.md) (agency download package)  
- Role training checklists under `docs/training/`  
- Escalation: [ESCALATION_PATHS.md](../operations-runbooks/ESCALATION_PATHS.md)  

**Out of Rapid Cortex support:** CAD vendor, 911 CPE, radio console, agency LAN, interpretation quality as a guaranteed SLA.

24/7 dedicated engineer: paid add-on, not assumed in hypercare.

---

## 7. Operational continuity planning

Rapid Cortex **degrading must not stop 911**. Continuity is **agency floor procedures first**, Rapid Cortex recovery second.

| Scenario | Agency (authoritative) | Rapid Cortex |
|----------|------------------------|--------------|
| Rapid Cortex web/API down | Dispatch on CAD/radio/CPE as today | Rollback B; status to approved contacts |
| Auth outage | Existing CAD sessions; do not share passwords | Cognito / authorizer triage |
| AI / STT vendor outage | Continue without co-pilot | Degraded mode; no invented procedures |
| Single-region AWS event | Floor continues on CAD | AWS status; failover only if a contracted multi-region design exists (**not** default) |
| Accidental data delete | Legal hold / agency records policy | PITR restore drill |
| Security incident | Agency CSO / CJIS ISO as required | IR runbook §9 in [cybersecurity-controls.md](./cybersecurity-controls.md) |

**Continuity checklist (keep in the playbook)**

- [ ] Floor SOP one-pager: “If Rapid Cortex is unavailable…”  
- [ ] SNS / paging path tested  
- [ ] Known-good release tags recorded  
- [ ] PITR confirmed **on** for the stage  
- [ ] Restore drill date (within 30 days of go-live)  
- [ ] Hypercare hours and who is on the bridge  

Default RTO/RPO are **not** guaranteed until Exhibit C SLA is executed ([SECURITY_QUESTIONNAIRE_RESPONSES.md](../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md)).

---

## 8. Risk mitigation planning

Product risks: [risk-register.md](../phase-0/risk-register.md). Implementation-specific treatments:

| ID | Risk | Mitigation (this project) | Residual |
|----|------|---------------------------|----------|
| IM-1 | Proposal over-claims CJIS/SOC/SOC-as-a-service | Use [README.md](./README.md) forbidden-language list; SE review of the submitted RFP | Agency still maps controls |
| IM-2 | Dispatchers treat AI as orders | Training + UI human-in-the-loop; no auto-CAD | Training decay — supervisor QA |
| IM-3 | CAD write-back enabled by mistake | Fail-closed flags; `deploy.sh` blocks prod write-back; UAT §5.1 | Operator error — change control |
| IM-4 | Cross-tenant exposure | Tenant guard + UAT §5.2 | Ongoing regression tests |
| IM-5 | Go-live without monitoring | G4: SNS subscription required | Alerts ignored if mailbox unattended |
| IM-6 | Scope creep (CAD/radio/certifications) | Change order; [CHANGE_ORDER_DRAFT.md](../go-to-market-sales/legal-drafts/CHANGE_ORDER_DRAFT.md) | Schedule slip |
| IM-7 | External AI on CJI-like content | SOW: AWS-only providers or delay CJIS-sensitive traffic | Residual vendor processing if allowed |
| IM-8 | No restore proof | Schedule restore drill before SLA claims | Untested PITR |
| IM-9 | Staffing / 24/7 expectation | Contract standard vs `support_upgrade_247` | After-hours delay on standard SKU |
| IM-10 | Agency LAN / CAD vendor delay | Cutover does not depend on CAD project | Dual-track schedule |

**Governance:** any new promise outside [MVP_SCOPE.md](../go-to-market-sales/MVP_SCOPE.md) follows [PROMISE_CONTROL.md](../go-to-market-sales/PROMISE_CONTROL.md). Protocol text changes follow [PROTOCOL_REVIEW_REQUIREMENTS.md](../security-compliance/PROTOCOL_REVIEW_REQUIREMENTS.md).

Review this table at kickoff, mid-pilot (week 9), and hypercare close.

---

## Related

- [cybersecurity-controls.md](./cybersecurity-controls.md)  
- [GTM_PACKAGE.md](../go-to-market-sales/GTM_PACKAGE.md)  
- [PILOT_GOVERNANCE.md](../go-to-market-sales/PILOT_GOVERNANCE.md)
