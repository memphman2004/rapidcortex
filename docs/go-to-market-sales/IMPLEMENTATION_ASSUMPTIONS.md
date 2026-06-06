# Implementation assumptions (pilot deployments)

**Audience:** solutions architects, DevOps, and agency IT. These are **defaults the documentation and runbooks assume** unless a written exception exists in the agency playbook.

## Platform

- **AWS** account(s) for SAM-deployed HTTP API + Lambdas + DynamoDB + Cognito per [DEPLOYMENT.md](./DEPLOYMENT.md) and [AWS_SETUP.md](./AWS_SETUP.md).
- **Next.js web** (`apps/web`) reachable over **HTTPS** in non-dev environments.
- **Browser-first** delivery; supported clients are modern evergreen browsers used in ECC environments ([NON_GOALS.md](./NON_GOALS.md) offline mobile apps).

## Identity and tenancy

- **Amazon Cognito** user pool aligned with API JWT authorizer; users carry **`custom:agencyId`** and **`custom:role`** ([AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)).
- **Recommended access pattern:** `NEXT_PUBLIC_AUTH_PROXY=1` with server **`API_UPSTREAM_BASE`** so the browser uses cookies, not JS-held bearer tokens ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)).

## Data and incidents

- Incidents and transcripts are created through the **product API** (or controlled admin flows)—not assumed to arrive from production CAD unless a connector project is in scope ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

## AI and multilingual

- **Lambda env** selects provider chain (`PRIMARY_PROVIDER`, etc.) per stage mappings in `infra/template.yaml` ([AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md)).
- **Multilingual** requires configured tables and vendor secrets; strict validation may block routes until healthy ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)).

## Operations

- **CORS** origins match real web hosts in pilot/prod-like stages ([PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)).
- **Monitoring** and on-call expectations per [RUNBOOK.md](./RUNBOOK.md) and [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md).

## Documentation mirroring (optional)

- Hosted **`docs/`** tree URL in **`NEXT_PUBLIC_DOCUMENTATION_BASE_URL`** so in-app **Admin → Pilot hub** links resolve for non-git users ([INSTALLATION.md](./INSTALLATION.md)).

## Related

- [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md)
- [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)
