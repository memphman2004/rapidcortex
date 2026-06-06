# FAQ — internal (sales, SE, support)

**Purpose:** short, **concrete** answers for recurring buyer and pilot-operator questions. Public-facing docs stay in [USER_GUIDE.md](./USER_GUIDE.md) and [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md).  
**Governance:** [PROMISE_CONTROL.md](./PROMISE_CONTROL.md), [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md).  
**Internal support operations:** [ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md](./ADMIN_TEAM_TROUBLESHOOTING_GUIDE.md) (intake, severity, escalation, ticket standards).

---

## Product & scope

**Q: Is Rapid Cortex a CAD replacement?**  
**A:** No. It is a browser co-pilot for assistive analysis and transcript workflows. CAD / CPE / radio remain system of record ([NON_GOALS.md](./NON_GOALS.md) §1).

**Q: Does the AI dispatch units?**  
**A:** No autonomous dispatch. Analysis is advisory; agency policy governs action ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).

**Q: Can it write back to CAD automatically?**  
**A:** Not as a default pilot commitment. Unsupervised write-back is a **non-goal** until reopened with legal and vendor review ([NON_GOALS.md](./NON_GOALS.md) §3, [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).

**Q: Is it CJIS certified?**  
**A:** Do not claim certification. Say “CJIS-aligned engineering patterns documented in [SECURITY_MODEL.md](./SECURITY_MODEL.md)” unless a formal assessment completed and comms approved.

**Q: What is live vs demo?**  
**A:** `/demo` and optional offline mock queue are **training/evaluation** paths, not live 911 ([NON_GOALS.md](./NON_GOALS.md) §5). Pilot hosts should use real API + auth ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)).

---

## Multilingual

**Q: Do we “support Spanish” (or any language)?**  
**A:** We support a **configured** pipeline (STT, translation, language ID). Quality varies by provider, audio, and phraseology. Human interpreter workflow remains in scope for edge cases ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

**Q: Why are segments blocked or missing?**  
**A:** Strict multilingual validation can reject bad configuration or unsafe ambiguity. Check **Admin → Integrations** for issue count and [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md).

**Q: Does the product replace interpreters?**  
**A:** No. It may flag lines for interpreter review or low confidence; **agency** defines follow-up ([SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md) §4).

---

## AI

**Q: Is the AI output legally or medically binding?**  
**A:** No. It is decision support; protocol alignment depends on configured packs and agency review ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).

**Q: Why did analysis fail?**  
**A:** Collect `requestId` and UTC time from the error payload if present; check provider keys and quotas ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)). UI may show `errorCode` from the API.

---

## Security & tenancy

**Q: Does the URL slug enforce tenancy?**  
**A:** No. JWT `custom:agencyId` + API enforcement do ([USER_GUIDE.md](./USER_GUIDE.md), [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md)).

**Q: Can an agency admin see another agency’s data in the app?**  
**A:** Not by design. If suspected cross-tenant leakage, treat as **incident** ([INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md)).

---

## Admin & support

**Q: Can we re-enable a deactivated Cognito user from the UI?**  
**A:** Not in the documented pilot UI path—use Cognito admin or documented CLI ([USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)).

**Q: Where do we see integration health?**  
**A:** **Admin → Integrations** and embedded status on **Admin → Configuration**—same `GET /api/integration/status` ([API_SURFACE.md](./API_SURFACE.md)).

**Q: What should admins export for a pilot retro?**  
**A:** Audit table JSON export (in-app), CloudWatch metrics per [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md), and notes in [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md).

---

## Commercial

**Q: Can we promise a feature by date?**  
**A:** Only with engineering + legal in writing. Default: roadmap language ([PROMISE_CONTROL.md](./PROMISE_CONTROL.md)).

**Q: Can we run 50 agencies on self-serve signup?**  
**A:** No. Pilot onboarding is constrained; arbitrary multi-tenant self-signup is a non-goal ([NON_GOALS.md](./NON_GOALS.md) §4).

---

## Updating this file

Add a row when the same question is asked **twice** in pilots. Link out to canonical docs rather than duplicating long procedures.
