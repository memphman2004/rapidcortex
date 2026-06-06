# Pilot governance — product, data, and AI

This document frames **governance** for the first-agency pilot: who may do what, how data is treated, and how AI output is positioned.

**Related canonical docs:** [MVP_SCOPE.md](./MVP_SCOPE.md) (assistive AI, roles), [NON_GOALS.md](./NON_GOALS.md), [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md), [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md), [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md), [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md).

## Roles (RBAC)

Cognito **`custom:role`** maps to product roles (see [USER_GUIDE.md](./USER_GUIDE.md)):

| Role | Pilot intent |
|------|----------------|
| **dispatcher** | Primary workspace: incidents, transcript, AI assist. |
| **supervisor** | Review queues, second look at escalations. |
| **admin** | Agency users, settings, audit views, invites (where APIs enabled). |
| **platform_superadmin** | Rapid Cortex operators only; cross-agency capabilities guarded in API. |

**Tenancy:** `custom:agencyId` must match agency-scoped data. Slug in the URL is **not** a security boundary.

## Data classification (pilot)

- Treat **incident metadata, transcripts, and AI output** as **sensitive operational data** — minimum necessary logging; no transcript content in application logs by default.
- **Audit events** — use agency-scoped audit APIs for accountability; retention follows agency policy and future formal retention modules.

## AI and protocols

- AI output is **decision support**, not dispatch authority — see user guide and in-product copy.
- **Protocol packs** are **agency-aligned** configurations; medical and operational authority remain with the agency and medical control as applicable.
- **Production AI** — staging/prod stacks default to **real providers** (see [AWS_SETUP.md](./AWS_SETUP.md), `infra/template.yaml` `ApiLambdaDefaults`). Mock-only chains require an explicit escape hatch (`AI_ALLOW_MOCK_ONLY_IN_PROD`).

## Human-in-the-loop

- Escalation and confidence signals are first-class in the multilingual and analysis pipelines.
- Supervisors validate AI-flagged items per agency SOP.

## Risk alignment

See [phase-0/risk-register.md](./phase-0/risk-register.md); pilot adds **operational** emphasis on config drift (mitigated by strict multilingual validation and integration status surfacing). Complete the [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) before go-live.
