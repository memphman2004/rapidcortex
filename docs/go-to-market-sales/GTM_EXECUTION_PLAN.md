# GTM execution plan — 90 days (pilot-first)

**Audience:** sales, solutions, implementation, support, engineering leads.  
**Assumption:** first revenue motion is a **controlled agency pilot** on a shared or dedicated stack — not self-serve GA.  
**Canonical scope:** [MVP_SCOPE.md](./MVP_SCOPE.md), [NON_GOALS.md](./NON_GOALS.md), [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md).

---

## Outcomes by day 90

1. **One signed pilot** (scope agreement + DPA + security review record) or documented counsel waiver.
2. **One agency live** on agreed modules with completed training checklists and playbook.
3. **Measurable pilot review** using [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) and [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md).
4. **Contract package** indexed and sendable — [CONTRACT_PACKAGE_INDEX.md](./CONTRACT_PACKAGE_INDEX.md).
5. **No oversell:** registry, routes, and sales language aligned per [PROMISE_CONTROL.md](./PROMISE_CONTROL.md).

---

## Phase 0 — Weeks 1–2: Package & governance

| # | Action | Owner | Deliverable | Done when |
|---|--------|-------|-------------|-----------|
| 0.1 | Assign owners for PLT-001–004 | Exec / legal | Named owners in [NEXT_DEPLOY_BLOCKERS.md](../deployment-infrastructure/NEXT_DEPLOY_BLOCKERS.md) | Names in tracker |
| 0.2 | Finalize pilot scope agreement | Legal | PDF without “Draft” | Counsel sign-off |
| 0.3 | Draft DPA from MSA privacy articles | Legal | Executable DPA doc | Ready for Adobe Sign |
| 0.4 | Reconcile contracting entity | Legal | Single entity on all templates | One legal name on MSA + Platform Agreement |
| 0.5 | Build trust packet | SE + security | Zip: questionnaire responses, subprocessor list, data flow PDF | Sent to first prospect |
| 0.6 | ICP qualification | Sales | [IDEAL_CUSTOMER_PROFILE.md](./IDEAL_CUSTOMER_PROFILE.md) scorecard per lead | 3+ qualified leads or 1 signed LOI |

---

## Phase 1 — Weeks 3–4: Discovery & technical fit

| # | Action | Owner | Deliverable | Done when |
|---|--------|-------|-------------|-----------|
| 1.1 | Discovery call | Sales + SE | Completed [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md) §1 | Workbook on file |
| 1.2 | Scope alignment | SE | Mark [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) rows in / out of pilot | Customer acknowledges in writing |
| 1.3 | CAD boundary | SE | Read-only vs write-back decision documented | Matches [CAD_CONNECTION_PLAYBOOK.md](../product-architecture/CAD_CONNECTION_PLAYBOOK.md) |
| 1.4 | Integration status review | DevOps | `GET /api/integration/status` clean for sold modules | Zero blockers for sold features |
| 1.5 | Environment decision | DevOps | dev / pilot / prod hostname documented in playbook | [AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md) §B filled |
| 1.6 | Security review kickoff | Agency IT + RC | Questionnaire returned or meeting held | PLT-002 evidence started |

---

## Phase 2 — Weeks 5–6: Contract & tenant setup

| # | Action | Owner | Deliverable | Done when |
|---|--------|-------|-------------|-----------|
| 2.1 | Execute pilot agreement + DPA | Legal + agency | Signed PDFs | PLT-001, PLT-003 closed |
| 2.2 | Privacy / retention acknowledgment | Agency + RC | [PRIVACY_RETENTION_DECISIONS.md](../security-compliance/PRIVACY_RETENTION_DECISIONS.md) signed or email | PLT-004 closed |
| 2.3 | Provision agency tenant | DevOps | Cognito pool claims, `agencyId`, stack config | [INSTALLATION.md](../deployment-infrastructure/INSTALLATION.md) checklist |
| 2.4 | Admin onboarding | Implementation | Agency admin completes [PILOT_AGENCY_ADMIN_CHECKLIST.md](../training/PILOT_AGENCY_ADMIN_CHECKLIST.md) | All boxes checked |
| 2.5 | Kickoff meeting | Sales + training | [PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md) | Meeting notes archived |
| 2.6 | Fill agency playbook | Implementation | Copy of playbook with URLs, contacts, escalation | §A–F complete |

---

## Phase 3 — Weeks 7–8: Training & floor readiness

| # | Action | Owner | Deliverable | Done when |
|---|--------|-------|-------------|-----------|
| 3.1 | Dispatcher training | Training lead | [TRAINING_DISPATCHER.md](../operations-runbooks/TRAINING_DISPATCHER.md) + [PILOT_DISPATCHER_CHECKLIST.md](../training/PILOT_DISPATCHER_CHECKLIST.md) | Sign-in sheet / LMS record |
| 3.2 | Supervisor training | Training lead | [TRAINING_SUPERVISOR.md](../operations-runbooks/TRAINING_SUPERVISOR.md) + [PILOT_SUPERVISOR_CHECKLIST.md](../training/PILOT_SUPERVISOR_CHECKLIST.md) | Sign-in sheet |
| 3.3 | Admin training | Training lead | [TRAINING_ADMIN.md](../operations-runbooks/TRAINING_ADMIN.md) | Admin sign-off |
| 3.4 | Pilot validation smoke | DevOps | [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) + `post-deploy-smoke.sh` log | Green smoke |
| 3.5 | Known limitations briefing | SE | [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md) walkthrough | Acknowledged in playbook |
| 3.6 | Go-live decision | Agency exec + RC | [PILOT_READINESS_CHECKLIST.md](../deployment-infrastructure/PILOT_READINESS_CHECKLIST.md) | Signed go-live |

---

## Phase 4 — Weeks 9–12: Live pilot & review

| # | Action | Owner | Deliverable | Done when |
|---|--------|-------|-------------|-----------|
| 4.1 | Week-1 support | Support | Tickets per [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md); `requestId` on all | No P1 > SLA without escalation |
| 4.2 | Weekly pilot summary | Implementation | Usage + incidents + config changes (no PII in deck) | 4 summaries delivered |
| 4.3 | Fortnightly review | Sales + agency | [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md) | 2 reviews minimum |
| 4.4 | Metrics capture | SE + agency | [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) rows filled | Baseline vs week-8 comparison |
| 4.5 | Feedback loop | Product | [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md) items triaged | Top 5 issues have owners |
| 4.6 | Expansion / exit decision | Exec | Written: expand tier, extend pilot, or wind down | Customer + RC sign-off |

---

## Phase 5 — Post–day 90: Production path (if expanding)

Only if pilot succeeds and governance closes:

| # | Action | Owner | Deliverable |
|---|--------|-------|-------------|
| 5.1 | Production MSA + Order Form | Legal + Finance | Executed MSA with filled Exhibit A/B |
| 5.2 | GA blockers triage | Engineering | Close GA-001–006 per [NEXT_DEPLOY_BLOCKERS.md](../deployment-infrastructure/NEXT_DEPLOY_BLOCKERS.md) |
| 5.3 | Second jurisdiction playbook | Implementation | New playbook copy; no scope drift |
| 5.4 | Reference customer package | Marketing | Case study draft (agency approval required) |

---

## Weekly standing agenda (30 min)

1. Pipeline: qualified leads vs ICP  
2. Blockers: PLT / GA IDs open  
3. Integration status for active pilots  
4. Support P1/P2 from last 7 days  
5. Promise control: any new claims in decks or email? ([PROMISE_CONTROL.md](./PROMISE_CONTROL.md))

---

## Related

- [GTM_PACKAGE.md](./GTM_PACKAGE.md) — role-based entry and nine-step lifecycle  
- [DOCUMENT_GAPS.md](./DOCUMENT_GAPS.md) — artifact status  
- [CONTRACT_PACKAGE_INDEX.md](./CONTRACT_PACKAGE_INDEX.md) — what to send when  
