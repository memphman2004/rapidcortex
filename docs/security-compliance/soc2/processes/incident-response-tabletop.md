# SOP — Incident response tabletop

**TSC:** CC7.3–CC7.4  
**Policy:** [POL-07](../policies/07-incident-response-policy.md)  
**Cadence:** Once before 2026-10-01; at least annually thereafter

## Goals

Prove the team can detect, contain, preserve evidence, and communicate **without** using production customer data as the scenario payload.

## Suggested scenarios (pick one per session)

1. **IAM key leaked** in a public gist — disable key, CloudTrail lookup, rotate deploy credentials.
2. **Cross-tenant scare** — dispatcher JWT with wrong `custom:agencyId`; confirm `AuthorizationService` denies; audit events.
3. **Secret provider compromise** (e.g. AI vendor) — rotate per [secrets-rotation-sop.md](../../../evidence/soc2-evidence/2026-10/secrets-rotation-sop.md), bounce Lambdas, customer comms draft (do not send in the drill unless it is a real incident).

## Facilitation

1. 60–90 minutes. Attendees: on-call, eng lead, security lead. Agency staff optional.
2. Use the template [ir-tabletop.template.md](../../../evidence/templates/soc2/ir-tabletop.template.md).
3. Inject: alarm name, time (UTC), what is **not** known.
4. Walk POL-07 steps. Time-box decisions.
5. Capture gaps (paging not wired, runbook stale, missing MFA on an IAM user).
6. File follow-up tickets with due dates.
7. Log the session in [tabletop-log.md](../evidence/tabletop-log.md) (date, scenario ID, number of attendees, ticket IDs — names optional).

This is a **drill**. Do not disable real IAM keys or rotate real secrets unless the scenario is live.
