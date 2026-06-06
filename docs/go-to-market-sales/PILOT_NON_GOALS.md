# Pilot non-goals — operational reference

**Use this page in sales calls, pilot kickoffs, and internal QBR prep** so language stays aligned with what the first-agency pilot actually is.

**Canonical exclusions list (full detail):** [NON_GOALS.md](./NON_GOALS.md) — if anything here disagrees, **NON_GOALS.md wins**.  
**Promise discipline:** [PROMISE_CONTROL.md](./PROMISE_CONTROL.md) · **Sales roles / escalation:** [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md).

---

## 1. Never promise in pilot (verbatim “no” list)

Use these as **hard stops** in meetings and drafts:

| Never promise | Point to |
|---------------|----------|
| CAD / 911 CPE / radio / RMS **replacement** or system-of-record swap | [NON_GOALS.md](./NON_GOALS.md) §1 |
| **Autonomous** dispatch or unsupervised **CAD write-back** | [NON_GOALS.md](./NON_GOALS.md) §3 |
| **Certified** CJIS, HIPAA, SOC 2, FedRAMP (or any attestation you cannot show) | [SECURITY_MODEL.md](./SECURITY_MODEL.md), [PROMISE_CONTROL.md](./PROMISE_CONTROL.md) §2 |
| **Guaranteed** AI accuracy, latency, or multilingual quality | [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) |
| “**All** languages” or interpreter **elimination** | [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md) §4 |
| **Universal** vendor-certified CAD integration “included” | [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md) |
| **Nationwide** unconstrained SaaS signup / unlimited vendor NOC | [NON_GOALS.md](./NON_GOALS.md) §4 |
| Training **`/demo`** traffic as **live** 911 or live CAD | [NON_GOALS.md](./NON_GOALS.md) §5 |
| **Default** training on agency production transcripts without legal/program sign-off | [NON_GOALS.md](./NON_GOALS.md) §3 |

---

## 2. Assistive vs automated (pilot scope)

| Assistive (in pilot scope when configured) | Automated / autonomous (not pilot default) |
|--------------------------------------------|---------------------------------------------|
| AI analysis panel, confidence, urgency, flags | Auto-dispatch, auto-field assignment without human action |
| Transcript display, segments, interpreter-review badges | Silent CAD narrative updates |
| Summaries and second-pair-of-eyes UX | Unsupervised outbound actions to external systems |

---

## 3. External dependencies (pilot plan must name an owner)

| Dependency | Why it is not “just software” |
|------------|-------------------------------|
| **CAD / vendor integrations** | Certification, VPN, message contracts, UAT windows—per vendor program |
| **Legal / compliance** | Retention, AI use, recording, discovery—agency + counsel |
| **Policy decisions** | When to trust AI, sampling, escalation to supervision |
| **Interpreter workflow maturity** | Flags are useless without SOP + staffing + training |
| **Cloud + AI providers** | Quotas, outages, key rotation—ops playbooks |

---

## 4. Multilingual (pilot limitations)

- Behavior is **deployment-dependent** (tables, secrets, strict validation). Check **Admin → Integrations**.  
- Strict mode can **block** bad data—this is preferable to wrong translations in audit-heavy workflows.  
- **Human** interpreters / bilingual staff remain accountable for high-risk dialogue.

---

## 5. AI guidance (pilot limitations)

- Outputs are **non-authoritative**; staff must validate against scene and protocol.  
- Medical/tactical **authority** requires protocol pack backing and agency review—not raw LLM improvisation ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).

---

## 6. Human judgment (cannot be delegated to software)

Dispatch outcomes, resource selection, legal holds, caller welfare, and official CAD narrative (where RC is not the record) remain **human** decisions unless the agency has a **separate**, approved automation program outside this pilot’s default.

---

## 7. Configurable vs fixed

- **Configurable:** environment, keys, tables, connector allowlists, Cognito custom attributes, provider choices.  
- **Fixed in product architecture:** RBAC shape, tenant isolation approach, core API semantics.  
- **Client-only toggles** (e.g. some pilot UX flags in browser storage) are **not** enterprise remote config.

---

## 8. Planned but not live

Anything marked future / planned in [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) or [PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md) is **not** a pilot deliverable until release + docs are updated.

---

## Related

- [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)  
- [FAQ_INTERNAL.md](./FAQ_INTERNAL.md)  
- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)  
