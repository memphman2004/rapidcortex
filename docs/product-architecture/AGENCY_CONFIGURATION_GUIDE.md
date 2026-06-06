# Agency configuration guide

**Audience:** agency IT + comms leadership + Rapid Cortex pilot lead. **What agencies “configure” in pilot** vs what **RC / DevOps** owns.

## What agency stakeholders decide (policy / program)

| Topic | Decision | Recorded in |
|-------|----------|-------------|
| Pilot users and roles | Who is dispatcher vs supervisor vs admin | [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md), Cognito |
| Assistive AI governance | When to trust / override AI | Agency SOP + [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md) |
| Privacy / retention posture | Legal retention expectations | [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) |
| Protocol packs | Which packs are approved | [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md) |
| Multilingual in pilot? | Languages in scope; escalation for interpreter | Workbook + training docs |

## What agency admins operate in the product (day-2)

| Task | UI | Limits |
|------|-----|--------|
| Provision users | Admin → Users | Roles `dispatcher`/`supervisor`/`admin`; same agency for agency admins |
| Verify integration health | Admin → Integrations / Configuration | Read-only |
| Review audit | Admin → Audit | Agency-scoped list |
| See web flags | Admin → Configuration | Read-only |

## What stays internal (Rapid Cortex / DevOps)

- AI provider credentials and model IDs per stage.
- Multilingual vendor keys, ARNs, strict validation toggles.
- SAM parameters: CORS origins, table names, PITR, alarms.
- Re-enabling disabled users if agency policy delegates to RC.

## Change requests from an agency

Use a simple ticket template:

1. **What** should change (behavior, not just “make AI better”)?
2. **Environment** (dev / staging / pilot).
3. **Risk** (floor exercise vs quiet window).
4. **Rollback** (previous tag / env snapshot).

## Related

- [PILOT_CONFIGURATION_MODEL.md](./PILOT_CONFIGURATION_MODEL.md)
- [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md)
