# First day on Rapid Cortex (pilot)

For **dispatchers**, **supervisors**, and **admins** on day one of live pilot access. Tick with a partner; keep evidence for retro ([PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md)).

## Everyone

- [ ] I can sign in at my agency **`/<slug>/login`** URL.
- [ ] **Connections** shows **Rapid Cortex API live** (if not, stop — [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)).
- [ ] I know where **KNOWN_LIMITATIONS** and **USER_GUIDE** live (bookmarked or printed [QUICKSTART_CARD.md](./QUICKSTART_CARD.md)).

## Dispatcher

- [ ] I opened **`/dashboard`**, selected a **test** incident (or first live incident per SOP).
- [ ] I read at least one transcript line with **speaker** + text; I know what **Interpreter review** and **Low confidence** mean ([TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md)).
- [ ] I pressed **Refresh AI** once and read **Intelligence** output including disclaimer text.
- [ ] I know to capture **UTC time**, **incident id**, and **`requestId`** if Intelligence shows an error.

## Supervisor

- [ ] I confirmed **`/review`** (or agreed supervisor workflow) with pilot lead.
- [ ] I sampled **audit** or review surfaces available to my role.
- [ ] I know escalation path for API outage ([ESCALATION_PATHS.md](./ESCALATION_PATHS.md)).

## Admin

- [ ] **`/admin/configuration`** matches expected public env + integration health.
- [ ] Pilot users exist with correct **roles** and **agency id** ([USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)).
- [ ] **`/admin/audit`** shows recent test events after exercises.

## End of shift

- [ ] Top issues logged for pilot retro (no PII in subject lines if policy requires).
