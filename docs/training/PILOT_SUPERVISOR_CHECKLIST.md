# Pilot checklist — supervisor

Use with [TRAINING_SUPERVISOR.md](../operations-runbooks/TRAINING_SUPERVISOR.md), [USER_GUIDE.md](../admin-user-management/USER_GUIDE.md), and the agency’s completed [AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md).

Supervisors **monitor and review**; they do not replace dispatch authority or CAD. AI output is **assistive** — [PILOT_GOVERNANCE.md](../go-to-market-sales/PILOT_GOVERNANCE.md).

---

## Before go-live

- [ ] Confirm supervisor accounts use role **`supervisor`** (not deprecated `commsupervisor`) with correct **`custom:agencyId`**.
- [ ] Walk [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md) with dispatch leadership — especially transcript simulator vs live audio, CAD read-only boundaries, and multilingual config requirements.
- [ ] Agree agency SOP for when dispatchers must **ignore** AI suggestions (document in playbook §D).
- [ ] Verify **Admin → Integrations** shows no blockers for modules in the pilot SOW.
- [ ] Identify who approves **CAD write-back** submissions if that module is in scope (separate legal scope; default **off**).

---

## Every shift

- [ ] Sign in at the **agency URL** from IT (correct jurisdiction slug + tenant).
- [ ] Confirm connection strip shows **Live backend** before monitoring real floor work.
- [ ] Spot-check active incidents: agency id, incident type, and transcript stream match the call being worked.
- [ ] Watch for repeated **analyze** or **multilingual** errors — escalate per [ESCALATION_PATHS.md](../operations-runbooks/ESCALATION_PATHS.md).

---

## QA and review queues

- [ ] Process **Review** / QA queues per agency SOP — document outcomes your agency requires.
- [ ] For **non-emergency / triage** queue (if enabled): verify human override path; no autonomous routing to CAD.
- [ ] Sample sessions weekly: agree / disagree / edit AI urgency or summary — record in pilot retro ([PILOT_REVIEW_TEMPLATE.md](../go-to-market-sales/PILOT_REVIEW_TEMPLATE.md)).
- [ ] Ensure supervisors do **not** approve their **own** CAD write-back submissions (separate JWT `sub` required).

---

## Supervisor monitoring (if enabled)

- [ ] Use monitoring features only where agency policy and labor agreements allow.
- [ ] Confirm **SUPERVISOR_WATCHING** or equivalent audit indicators are understood by staff.
- [ ] Do not use monitoring for purposes outside documented pilot scope.

---

## Escalation to Rapid Cortex

When opening a support thread, include:

- Approximate **UTC time** and **incident id** (no PII in subject line if policy requires)
- **requestId** from API error JSON when available
- Whether issue affects **one user**, **one agency**, or **all users**

See [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md) and [TROUBLESHOOTING_GUIDE.md](../operations-runbooks/TROUBLESHOOTING_GUIDE.md).

---

## Week one (supervisor lead)

- [ ] Debrief dispatchers after first live day — capture friction in [FEEDBACK_LOOP.md](../go-to-market-sales/FEEDBACK_LOOP.md).
- [ ] Confirm [PILOT_DISPATCHER_CHECKLIST.md](./PILOT_DISPATCHER_CHECKLIST.md) is in use on the floor.
- [ ] Attend or lead first **fortnightly pilot review** ([PILOT_REVIEW_TEMPLATE.md](../go-to-market-sales/PILOT_REVIEW_TEMPLATE.md)).

---

## Related

- Dispatcher checklist: [PILOT_DISPATCHER_CHECKLIST.md](./PILOT_DISPATCHER_CHECKLIST.md)
- Agency admin checklist: [PILOT_AGENCY_ADMIN_CHECKLIST.md](./PILOT_AGENCY_ADMIN_CHECKLIST.md)
