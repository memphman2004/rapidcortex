# Pilot success metrics (measurable)

**Purpose:** define **observable** indicators so pilot success is judged on evidence, not narrative.  
**Governance:** [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md). **Feedback process:** [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md). **Meeting template:** [PILOT_REVIEW_TEMPLATE.md](./PILOT_REVIEW_TEMPLATE.md).

Qualitative trust (dispatcher/supervisor confidence) remains important—capture it in retros—but **do not** convert it to contractual SLAs unless procurement agrees in writing.

---

## 1. Usage and adoption

| Metric | How to measure | Target direction | Product / ops data |
|--------|----------------|-------------------|---------------------|
| **Active dispatch users / week** | Count distinct `actorId` on transcript or incident actions in audit sample | Stable or increasing | `GET /api/audit/events` sample; agency BI export |
| **Sessions per shift** | Incidents opened or updated per day / per agency | Aligns with live or exercise volume | Incident API + audit |
| **Admin engagement** | Distinct admins hitting `/admin/*` weekly | Enough to cover users + config | Analytics pipeline or proxy logs (no PII in shared decks) |

---

## 2. Response-time and support metrics

| Metric | How to measure | Notes |
|--------|----------------|-------|
| **P1 / P2 incident count** | Per [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | Track RC vs agency vs vendor |
| **Time to first response** | Support thread timestamp vs ticket open | Use agreed channel ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)) |
| **Time to mitigation** | When workaround or fix deployed | Tag with `GIT_SHA` / release |

---

## 3. Transcript and translation usefulness

| Metric | How to measure | Target direction |
|--------|----------------|------------------|
| **Segments posted per incident** | Transcript POST volume vs incidents | Non-zero for live path |
| **Interpreter review rate** | Share of segments flagged `needsInterpreterReview` (if pipeline sets) | Agency-defined band—not “zero at all costs” |
| **Low-confidence rate** | Share of segments or analyses below agreed threshold | Investigate spikes; document in [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) |
| **STT / translation error reports** | Count of support tickets with examples (redacted) | Decreasing after config fixes |

**In-app signals:** transcript badges and AI confidence meter on the dispatcher workspace (when backend populates fields).

---

## 4. AI analysis usefulness

| Metric | How to measure | Target direction |
|--------|----------------|------------------|
| **Analyze success rate** | `POST .../analyze` success vs `errorCode` | High; categorize failures ([TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md)) |
| **Time to first analysis** | Latency from last transcript segment to analysis ready | Within agency tolerance (not a public SLA unless contracted) |
| **Supervisor spot-check agreement** | Sampled sessions: agree / disagree / edit AI urgency | Qualitative scorecard in retro |

---

## 5. Admin satisfaction

| Metric | How to measure |
|--------|----------------|
| **Setup checklist completion** | [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md), in-app **Admin → Pilot hub** milestones |
| **Integration readiness** | `multilingualIssueCount === 0`, language sessions configured when strict mode on, assets bucket when needed | **Admin → Integrations** |
| **Time to first provisioned user** | Invite → first login | [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md) |

---

## 6. Training completion

| Metric | Source |
|--------|--------|
| **Required modules done** | Checklists: [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md), [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md), role playbooks under `docs/training/` |
| **Demo vs live** | Confirm pilot users trained on **live** path, not only `/demo` |

---

## 7. Incidents and defects

| Metric | Source |
|--------|--------|
| **Production defects** | Issue tracker; link `requestId` |
| **Security incidents** | [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) |
| **RC platform availability** | CloudWatch SLOs per [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md) |

---

## 8. What the product should expose for pilot evaluation

| Surface | Data |
|---------|------|
| **Admin → Audit** | Operational events (export JSON for retro) |
| **Admin → Integrations** | `GET /api/integration/status` — multilingual issues, AI chain, connector mode |
| **Admin → Configuration** | Read-only deploy flags + embedded status |
| **Dispatcher workspace** | Analysis confidence, transcript badges, errors with `requestId` when API returns it |
| **Support bundle** | HAR optional; never send secrets—rotate keys if leaked ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)) |

---

## Related

- [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md) — index + balanced scorecard framing  
- [GTM_PACKAGE.md](./GTM_PACKAGE.md) — lifecycle  
