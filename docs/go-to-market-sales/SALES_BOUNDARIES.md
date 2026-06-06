# Sales boundaries (roles, language, escalation)

**Audience:** sales, solutions engineers, partners, and product managers on customer calls.  
**Purpose:** define **who may promise what**, standard **safe phrasing**, and **what to do** when the buyer asks for out-of-scope capabilities—without improvising.

Canonical scope: [MVP_SCOPE.md](./MVP_SCOPE.md). Canonical exclusions: [NON_GOALS.md](./NON_GOALS.md). Promise process: [PROMISE_CONTROL.md](./PROMISE_CONTROL.md).

---

## 1. Role boundaries (what each role may commit)

| Role | May commit to | Must **not** commit to (without written exception) |
|------|---------------|------------------------------------------------------|
| **Sales** | Meeting cadence, access to docs, introduction to implementation, **pilot-shaped** commercial framing | Custom dev deadlines, compliance certifications, vendor-certified integrations, SLA numbers |
| **Solutions / SE** | Architecture fit **as documented**, environment variables and tables **as in INSTALLATION**, training paths **as in docs** | Undocumented APIs, feature flags not in repo, “we will ship X by date” without engineering sign-off |
| **Product / Eng (on call)** | Behavior of **shipped** code in named environment; integration status interpretation | Roadmap dates as contractual; third-party vendor incident resolution times |
| **Agency champion** | Internal staffing, SOP changes, policy for AI use | RC product behavior not in their admin-visible configuration |

**Escalation:** If a customer requests a commitment in the right column, response is: “That requires [engineering / legal / vendor program] sign-off; we will follow up in writing against MVP + non-goals.” Do not verbally bridge the gap.

---

## 2. Assistive vs automated (call script)

Use this verbatim tiering when asked “Does the AI dispatch?” or “Does it write to CAD?”

1. **“The product is assistive.”** It surfaces analysis, transcript structure, and flags for trained staff.  
2. **“Agency policy decides action.”** The system does not replace CAD, CPE, or radio as system of record in the pilot.  
3. **“Outbound automation is explicitly out of scope for the first-agency pilot unless reopened with legal and vendor review.”** ([NON_GOALS.md](./NON_GOALS.md) §3.)

---

## 3. External dependencies (say these early, not after failure)

| Topic | Say once in discovery | Why |
|-------|----------------------|-----|
| CAD / Motorola / other vendors | “Each vendor combination is a **project** with its own timeline, not a checkbox in the base SKU.” | Prevents “it should just connect” |
| Compliance | “We document CJIS-**aligned** controls; **certification** language requires a completed assessment program.” | Prevents procurement trap |
| Multilingual | “Quality depends on configured STT, translation, language ID, and **human** interpreter workflow for edge cases.” | Prevents accuracy lawsuits |
| Interpreter maturity | “UI flags low confidence and interpreter review; **your** SOP defines follow-up.” | Prevents blame shift to software alone |

---

## 4. Multilingual support — boundaries for customer conversations

| Safe to say | Unsafe without proof |
|-------------|----------------------|
| “When your deployment configures the multilingual pipeline per our runbooks, the product can show translated / detected-language context **for assistive review**.” | “We support all languages equally well.” |
| “Strict validation can block segments when configuration is wrong—this is intentional to avoid silent bad data.” | “Real-time interpretation quality is guaranteed.” |
| “Interpreter review flags are first-class in the transcript UI when the pipeline sets them.” | “You can remove human interpreters from the workflow.” |

Technical detail: [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md), in-app **Admin → Integrations** (`GET /api/integration/status`).

---

## 5. AI guidance — boundaries

| Safe to say | Unsafe |
|-------------|--------|
| “Analysis is **decision support** with confidence and urgency fields; staff validate against protocol and scene.” | “The AI diagnoses” or “the AI determines dispatch priority as law.” |
| “Protocol-aligned coaching requires **agency-approved** protocol packs.” | “Always follows latest AHA / local medical standard” without naming the configured pack + review record. |

---

## 6. Human judgment (non-negotiable list)

Staff must judge (software does not replace):

- Whether to act on AI recommendations.  
- Caller safety and scene dynamics.  
- Resource allocation and CAD narrative (manual or approved workflows).  
- Escalation to supervision, legal, or language services.  
- What to record in official records outside RC.

---

## 7. Configurable vs fixed (pilot honesty)

| Configurable (tenant / deploy) | Fixed or product-wide |
|----------------------------------|-------------------------|
| Env vars, secrets stores, DynamoDB tables, connector allowlists, Cognito attributes | Core RBAC model, API route semantics, tenant isolation pattern (`custom:agencyId`) |
| **Admin → Configuration** client-side pilot UX flags (browser storage; not authoritative) | That **client flags are not** a remote feature-flag service |
| Which AI providers are wired in the deployment | That provider outages degrade analysis—UI shows loading / errors |

**Admin UI:** Configuration screens are **read-only truth** from deploy + API where implemented—not a full remote admin for every backend knob ([AGENCY_CONFIGURATION_GUIDE.md](./AGENCY_CONFIGURATION_GUIDE.md)).

---

## 8. Planned but not live

- Anything labeled **future** / **planned** in [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) or [PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md) must be spoken as **roadmap**, not current pilot deliverable.  
- If a slide deck includes roadmap items, **watermark or section** them so procurement cannot treat them as scope.

---

## 9. When stuck on a call

1. Pause: “I want to answer precisely against our pilot documentation.”  
2. Cite: [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) row or [NON_GOALS.md](./NON_GOALS.md) section.  
3. Offer: written follow-up with **named** environment (staging vs pilot) and **GIT_SHA / release** if technical.  
4. Log: add topic to [FAQ_INTERNAL.md](./FAQ_INTERNAL.md) if it recurs.

---

## Related

- [FAQ_INTERNAL.md](./FAQ_INTERNAL.md)  
- [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md)  
- [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md)  
