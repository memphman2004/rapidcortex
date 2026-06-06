# Risk register (MVP / pilot)

| ID | Risk | Impact | Likelihood | Mitigation | Owner |
|----|------|--------|------------|------------|-------|
| R1 | **Over-trust in AI** — dispatchers follow bad suggestions | Safety / legal | Med | Human-in-the-loop copy, escalation UX, supervisor review, confidence display | Product + Eng |
| R2 | **LLM invents procedures** | Safety | Med | Protocol engine + Zod + prompts; no coach text without pack | Eng |
| R3 | **Cross-tenant data leak** | Critical trust | Low | `TenantAccessGuard` on all handlers; tests; code review checklist | Eng |
| R4 | **Pilot data sensitivity** (CJIS-aligned expectations) | Legal / adoption | Med | Audit logging, retention hooks, env separation, no PII in logs by default | Eng + Legal |
| R5 | **Vendor / integration slip** — SDK in core code | Maintainability | Med | `packages/integrations` only; interface tests | Eng |
| R6 | **Demo / prod config drift** | Incidents in prod | Med | `.env.example`, single config loader pattern, CI build all workspaces | Eng |
| R7 | **Columbus vs Erie** differing SOPs | UX mismatch | Med | Agency config + protocol packs per agency path (roadmap); pilot playbooks | Product |
| R8 | **Availability** of Lambda + Dynamo during incident | Ops | Med | Health checks, backoff on AI, clear UI errors | Eng |

## Review triggers

- Any change to **protocol text** or **pack selection** → follow [../PROTOCOL_REVIEW_REQUIREMENTS.md](../PROTOCOL_REVIEW_REQUIREMENTS.md) and agency policy.
- Any new **PII field** stored or logged → privacy review ([../PRIVACY_RETENTION_DECISIONS.md](../PRIVACY_RETENTION_DECISIONS.md)).
- Any **Cognito** or **IAM** policy widening → peer review + changelog.

## Governance cross-links

- [../MVP_SCOPE.md](../MVP_SCOPE.md), [../NON_GOALS.md](../NON_GOALS.md), [../PILOT_READINESS_CHECKLIST.md](../PILOT_READINESS_CHECKLIST.md), [../AGENCY_PLAYBOOK_TEMPLATE.md](../AGENCY_PLAYBOOK_TEMPLATE.md)
