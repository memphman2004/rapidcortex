# Promise control (internal)

**Audience:** sales, solutions engineering, product, legal, and anyone who speaks externally about Rapid Cortex during a **pilot**.  
**Purpose:** keep language **truthful and operational** so pilots do not start with contractual or reputational debt.

If this document conflicts with [MVP_SCOPE.md](./MVP_SCOPE.md) or [NON_GOALS.md](./NON_GOALS.md), **MVP_SCOPE + NON_GOALS win**.

---

## 1. Mandatory external checks before a claim

| Claim type | Must be verified against |
|------------|---------------------------|
| Any capability in a deck, SOW, or email | [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md), [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) (maturity column) |
| “We do / we will / we guarantee” | [NON_GOALS.md](./NON_GOALS.md), [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md) |
| Compliance or certification | [SECURITY_MODEL.md](./SECURITY_MODEL.md) — **no certification claims** without completed assessment |
| CAD / RMS / CPE / radio | [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md) — vendor program, not product default |
| Multilingual accuracy or coverage | [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), agency env + `GET /api/integration/status` |
| AI behavior | [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md), [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md) |

**Rule:** If it is not in code + docs for this release branch, treat it as **roadmap** and label it explicitly as “planned / not in pilot build.”

---

## 2. Phrases that must **not** appear in pilot-facing materials without legal + product sign-off

- “Certified for CJIS / HIPAA / SOC 2 / FedRAMP” (use **aligned controls** or **assessment in progress** only if true and approved).
- “Replaces CAD / 911 CPE / radio / RMS as system of record.”
- “Autonomous dispatch” or “AI dispatches units.”
- “Guaranteed” latency, accuracy, or availability numbers unless tied to a **signed** SLA with defined measurement.
- “Full bilingual support” or “eliminates interpreters.”
- “Trained on your agency’s production transcripts” without explicit program + legal approval.
- “Live CAD ingest” or “bidirectional CAD” unless the **named** connector project is in contract and deployed for that agency.

---

## 3. Assistive vs automated (required wording discipline)

| Category | Allowed summary | Do **not** imply |
|----------|-----------------|------------------|
| **Assistive** | Suggestions, summaries, flags, second-pair-of-eyes UI | That the product decides dispatch outcomes |
| **Human-in-the-loop** | Agency-trained staff review before action | That supervisors are optional for safety-critical use |
| **Configured pipeline** | Multilingual / AI **when** env + tables + keys are set per docs | That every tenant has the same pipeline behavior out of the box |
| **Automation (out of pilot default)** | Auto-CAD write-back, unsupervised outbound actions | That these are on by default or vendor-approved for the pilot tenant |

Canonical table: [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md).

---

## 4. External dependencies (own explicitly in every pilot plan)

These are **not** solved by product code alone; they belong in the joint project plan with owners and dates.

| Dependency | What “done” looks like for pilot | Typical owners |
|------------|----------------------------------|----------------|
| **CAD / vendor integrations** | Named adapter or API-only posture documented; no implied certification | Agency IT + vendor + RC engineering |
| **Legal / compliance** | Retention, discovery, AI use, recording consent — signed policy or explicit “agency owns” | Agency legal + RC legal/PM |
| **Policy decisions** | When to trust AI, interpreter escalation, supervisor sampling rate | Agency ops + supervision |
| **Interpreter workflow maturity** | Staff know how to use `needsInterpreterReview` / low-confidence paths; SOPs updated | Training + supervision |
| **Identity and tenancy** | Cognito app, `custom:agencyId` / `custom:role` conventions enforced | Agency admin + RC DevOps |

---

## 5. Review cadence (minimum)

| When | Action |
|------|--------|
| Before each customer meeting | Skim [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) + [FAQ_INTERNAL.md](./FAQ_INTERNAL.md) for the agenda topics |
| After scope slides change | Diff against [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) |
| Weekly during active pilot | Note new boundaries in [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) or backlog |
| Fortnightly | Use [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md) and [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md) |

---

## 6. Related

- [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md) — roles and escalation when asked for out-of-scope items  
- [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md) — pilot conversation quick reference  
- [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md) — how success is measured without over-claiming  
