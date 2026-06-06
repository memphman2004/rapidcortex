# Ideal customer profile (ICP) — pilot stage

**Not a marketing persona deck:** this is a **fit filter** so pilots start with aligned expectations. Product boundaries remain in [MVP_SCOPE.md](./MVP_SCOPE.md) and [NON_GOALS.md](./NON_GOALS.md).

## Strong fit (pilot)

- **Single ECC / PSAP or clearly bounded agency** willing to run a **controlled** pilot with written assistive-AI governance ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).
- **Agency IT / security** can support **Amazon Cognito**-based access, URL deployment, and optional secrets for AI / multilingual ([INSTALLATION.md](./INSTALLATION.md)).
- **Supervision culture** that will **review** escalations and AI-assisted outputs per SOP—not “set and forget” automation.
- **Side-by-side posture:** CAD, radio, and logging remain authoritative; Rapid Cortex is an **intelligence layer** ([PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)).

## Weak fit (defer or reshape)

- Expectation that Rapid Cortex **replaces** CAD, 911 CPE, radio console, or logging as **system of record** ([NON_GOALS.md](./NON_GOALS.md)).
- Requirement for **certified CJIS / HIPAA / SOC 2** *claims* in the pilot window without a completed assessment program ([SECURITY_MODEL.md](./SECURITY_MODEL.md)).
- **Unbounded multi-tenant self-serve** public signup without agency onboarding ([NON_GOALS.md](./NON_GOALS.md)).
- **Mandatory bidirectional CAD** or **guaranteed live radio ingest** as a **Day-1 pilot deliverable** without a scoped connector project ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md), [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

## Roles we optimize for in pilot

Dispatchers, supervisors, and agency **admins** who will own user lifecycle and read integration/audit surfaces ([USER_GUIDE.md](./USER_GUIDE.md), [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)).

## Related

- [USE_CASES.md](./USE_CASES.md)
- [PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md)
- [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)
