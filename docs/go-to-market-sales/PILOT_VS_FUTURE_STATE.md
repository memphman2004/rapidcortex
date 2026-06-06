# Pilot state vs future roadmap

**Purpose:** separate what a **signed first-agency pilot** should expect from what belongs in **later phases** or **separate vendor projects**. Canonical exclusions: [NON_GOALS.md](./NON_GOALS.md). Engineering ordering: [phase-0/mvp-features.md](./phase-0/mvp-features.md).

## In the pilot “box” (expected)

- Browser dispatcher workspace with **real** incidents/transcripts/analyses when API is configured.
- Cognito auth, RBAC, audit surfaces, admin integration status, training **`/demo`** path.
- Side-by-side posture with CAD/radio; **assistive** AI and protocol packs per governance docs.

Detailed rows: **[FEATURE_MATRIX.md](./FEATURE_MATRIX.md)**.

## Pilot-adjacent but not universal GA

- **Multilingual** voice/text when explicitly configured and validated for the stage.
- **Optional** dashboard transcript trainer for academy POSTs—default-off on live API hosts ([NON_GOALS.md](./NON_GOALS.md) §5).
- **Billing** UI and read-model IDs without implying full Square lifecycle for every tenant.

## Future / explicitly not pilot-default

- **Bidirectional CAD** certification and write-back automation without legal + vendor programs ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).
- **Universal live radio ingest** as an unscoped Day-1 promise.
- **Native desktop** primary client ([NON_GOALS.md](./NON_GOALS.md)).
- **Unbounded self-serve multi-tenant** SaaS without agency onboarding ([NON_GOALS.md](./NON_GOALS.md)).
- **Compliance certification marketing** (CJIS, HIPAA, SOC 2, FedRAMP) without completed assessment ([SECURITY_MODEL.md](./SECURITY_MODEL.md)).

## How we avoid drift

- Sales and SE use **[SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)** and this file in the same deck as **[MVP_SCOPE.md](./MVP_SCOPE.md)**.
- When roadmap work ships, update **FEATURE_MATRIX**, **KNOWN_LIMITATIONS**, and **[PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)** in the same change set.

## Related

- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)
- [USE_CASES.md](./USE_CASES.md)
