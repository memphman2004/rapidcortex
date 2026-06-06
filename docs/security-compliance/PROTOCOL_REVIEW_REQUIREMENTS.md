# Protocol review requirements

**Dependency rule:** Any **protocol guidance** shown in the product (coaching phrases, step text, escalation wording sourced from the **protocol engine / packs**) must be **traceable to agency-approved content** and subject to the review process below. This does **not** remove the need for trained staff judgment ([MVP_SCOPE.md](./MVP_SCOPE.md) — assistive AI).

LLM output may **summarize, classify, and suggest questions** within validated schemas; **repeatable caller-facing instructions** for life-safety and operational procedures come from **packs**, not free-form model invention ([phase-0/product-one-pager.md](./phase-0/product-one-pager.md)).

---

## 1. What counts as “protocol guidance”

Treat as in scope for this document if the UI presents it as **protocol**, **coach**, **step**, **pack**, or equivalent branding, including:

- Phrases intended to be read or paraphrased to callers.
- Ordered steps (e.g. CPR, choking, bleeding, evacuation patterns).
- Escalation text bundled with a protocol pack step.

**Out of scope** for pack-only rules (still subject to AI governance): free-text **AI analysis** fields that do not present themselves as authoritative protocol steps—those remain **decision support** and must use non-authoritative language in prompts and UI.

## 2. Agency responsibilities

| Requirement | Detail |
|-------------|--------|
| **Designated authority** | Medical director, protocol committee, or delegated SME named in [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md). |
| **Versioning** | Each pilot uses **explicit pack version(s)**; document hash or semver in the playbook. |
| **Change control** | When pack JSON or selection logic changes mid-pilot, re-run review and communicate to training leads. |
| **SOP alignment** | Local SOP overrides software copy—document divergence in the playbook. |

## 3. Engineering / product responsibilities

- **No deployment** of new default pack text to **production pilot** without agency sign-off recorded.
- **Schema and tests** for packs where the repo enforces structure (`packages/protocols`); invalid packs must fail CI or deployment gates as implemented.
- **Audit** significant pack attach events to analyses where the product logs them.

## 4. Review triggers (minimum)

From [phase-0/risk-register.md](./phase-0/risk-register.md), reinforced here:

- Any change to **protocol text** or **pack selection** rules affecting live pilot.
- Any feature that **mixes** LLM-generated procedural steps with pack-sourced UI without a clear visual distinction (should be avoided; if proposed, architecture + legal review).

## 5. Related documents

- [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md) — AI + protocol framing.
- [NON_GOALS.md](./NON_GOALS.md) — LLM procedures without pack backing.
- [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md) — CAD write-back remains a non-goal for MVP.
