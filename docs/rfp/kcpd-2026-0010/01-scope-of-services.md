# Scope of Services  
## KCPD RFP 2026-0010 Addendum 4  
### AI-Assisted Non-Emergency Call Management Solution

**Offeror:** Apps on Demand LLC — NexCort iQ Call Assist  
**Product:** NexCort iQ Call Assist (non-emergency AI triage and intake)  
**Positioning:** Augments telecommunicators; does **not** replace 911 CPE, CAD, radio, or medical direction.

This Scope of Services maps one-for-one to the Bid Lines in the solicitation. Positions are **FULL**, **PARTIAL**, **N/A**, or **COMPLIANT (services)**. PARTIAL lines describe what ships today and what requires agency UAT, telephony partnership, or a signed addendum.

---

## 1. Project objective (compliance statement)

NexCort iQ Call Assist provides an AI-assisted **non-emergency** call management path that:

- Answers and triages routine non-emergency interactions with natural conversational speech (Amazon Connect + Amazon Lex),  
- Collects structured intake and recommends CAD natures / priorities for human review,  
- Immediately transfers to a live call taker when an emergency, distress, or low-confidence condition is detected,  
- Diverts eligible callers to online / self-service reporting,  
- Warm-transfers non-police destinations (e.g., 311, Parks, Water) per tenant directory,  
- Keeps Motorola PremierOne (or successor CAD) as the **system of record** until a signed CAD write-back addendum and UAT are complete.

RapidSOS integration (former Bid Line 12) is **out of scope** per public Q&A.

---

## 2. Bid line responses

### Line 1 — AI Call Answering — **PARTIAL**

**Included:** Conversational non-emergency answering; barge-in / interrupted speech handling on the Connect path; emergency keyword and distress escalation with **hard stop** (AI does not continue the call); intelligent follow-up questions; confidence-based human escalation; never-fabricate grounding against intake + knowledge; AI disclosure language (tenant-configurable, seeded for KCPD).

**Boundaries:** Call Assist attaches to the **non-emergency** voice path. It is not a replacement for the Department’s 911 phone system. Production DID cutover requires un-mocked Connect/Lex, agency telephony engineering, and UAT. Special-population handling escalates to humans; the product does not clinically diagnose mental illness.

### Line 2 — Call Intake — **FULL**

Collects incident type, exact location, apartment/business name, cross streets, direction of travel, vehicle information, license plates, suspect descriptions, weapons, injuries, caller contact information, callback number, and preferred language. Dynamic questioning asks for additional fields based on incident type.

### Line 3 — Incident Classification — **PARTIAL**

**Included:** Recommended CAD incident types and priorities via triage + nature mapping; session indicators for duplicate / repeat caller / chronic location when history signals are available.

**Boundaries:** Live PremierOne nearby-incident and premise-hazard queries require vendor UAT. Until connected, officer-safety alerts via CAD are not claimed as live. Human review remains required before any CAD write.

### Line 4 — AI-Assisted Call Triage — **FULL**

Automatic classification among: Emergency; Non-emergency police; Animal Control; Parking; Code Enforcement; Public Works; Tow Complaint; Noise Complaint; Report Only; Information Request; CarFax / online vehicle reporting eligible; Online reporting eligible. **Emergency always overrides.**

*Note:* “CarFax Reporting eligible” in this bid means KCPD online vehicle reporting self-service, not the commercial Carfax insurance product.

### Line 5 — Advanced AI Capabilities — **PARTIAL**

Uses NLP/LLM via Lex + agency-approved AI providers, context awareness, sentiment analysis, voice-emotion signals (Amazon Comprehend / Contact Lens path when enabled), confidence scoring, intent detection, automatic summarization, and dynamic questioning. Continuous learning is **human-gated** (QA → prompt proposal → admin approve). Not a custom acoustic emotion CNN.

### Line 6 — Language Support — **PARTIAL**

English and Spanish are first-class. Additional Lex locales are tenant-configurable. Interpreter bridge is tenant configuration (e.g., Language Line remains in SOP). Real-time translation uses the platform translation path when enabled. TTY/TDD: Connect attribute detection + SMS fallback scripts — **not** a certified 911 TTY CPE replacement.

### Line 7 — Multichannel Communications — **PARTIAL**

**Voice** (primary Call Assist path), **SMS** (self-service / status links), **Video** via existing NexCort iQ live video / Rapid Vision assist when the agency enables that platform feature — not a separate Call Assist video stack.

### Line 8 — Callback Features — **PARTIAL**

Captures callback numbers; offers after-hours / overflow callbacks; outbound campaign model via Amazon Connect. Outbound fails closed until Connect instance, contact flow, and caller ID are configured for the tenant.

### Line 9 — Self-Service Options — **FULL**

Directs eligible callers how to file online reports (including KCPD online vehicle reporting URL when seeded) and serves frequently requested information from the knowledge base / FAQ.

### Line 10 — Knowledge Base — **FULL**

Agency-managed articles for policies, FAQs, public information, city and police services, and directory transfers. Responses are grounded; the model must not fabricate facts not present in intake or knowledge hits.

### Line 11 — Motorola CAD Integration — **PARTIAL**

**Included:** PremierOne adapter plus CAD-agnostic provider pattern (Tyler, CentralSquare, Hexagon, Zetron, Mark43, Versaterm, and others as configured). Human-reviewed CAD create packet; dual fail-closed gates (`CAD_WRITEBACK_ENABLED` and Call Assist CAD push flag) default **off**.

**Phase 1 (Day 1 posture):** Shadow / review packet; call taker or supervisor approves before send.  
**Phase 2 (after signed addendum + UAT):** Live create / notes; then disposition, unit status, attachments, and deeper history as Motorola professional services and agency testing allow.

**CAD portability:** If the Department transitions off PremierOne, the same review packet targets another configured CAD provider.

### Line 12 — RapidSOS — **N/A**

Deleted per addendum / public Q&A. Not bid. Not demonstrated.

### Line 13 — Telephony Integration — **PARTIAL**

Amazon Connect webhooks, contact-flow actions, ANI/ALI and Caller ID as contact attributes. SIP/VoIP CPE, queue management, and overflow routing remain with the Department’s existing telephony / 911 phone system. Call Assist is the AI front-end on the non-emergency path, not a CPE replacement.

### Line 14 — RMS Integration — **PARTIAL**

Motorola Records interface and fail-closed draft path exist. Live RMS filing is a **project** gated by feature flag and credentials — not Day-1 enabled.

### Line 15 — GIS Integration — **PARTIAL**

Caller-stated location capture plus optional geocode / zone / jurisdiction enrichment from tenant configuration. Not a full agency GIS console. Location-accuracy percentages are measured in UAT, not guaranteed in this Scope.

### Line 16 — CJIS Requirements — **PARTIAL**

CJIS-**aligned** controls: MFA, encryption in transit and at rest, role-based permissions, detailed audit logging. See [05-cybersecurity-and-cjis-cover.md](./05-cybersecurity-and-cjis-cover.md) and [../cybersecurity-controls.md](../cybersecurity-controls.md).

**Not claimed:** FBI CJIS certification / CJIS-ATP. Agency completes Security Addendum, personnel screening, and residual-risk acceptance. Annual penetration testing is available as a separate assessment SOW.

### Line 17 — Cybersecurity — **PARTIAL**

AWS WAF, Secrets Manager, tenant isolation, authenticated Connect webhooks, monitoring and IR runbooks. Offeror will engage KCPD Information Technology Support Unit as required. A staffed 24×7 SOC is available only if purchased as a support upgrade — not implied by base SaaS.

### Line 18 — Data Retention — **FULL**

Tenant-configurable retention for audio, transcripts, and related records; legal hold; export to common formats (e.g., MP3/WAV/JSON/CSV/PDF as configured); chain-of-custody via audit. Missouri Sunshine Law (RSMo 610) display defaults are seed policy labels — **Department policy controls** final retention.

### Line 19 — Quality Assurance — **FULL**

AI transcript review, supervisor review tools, quality scoring, keyword search, AI performance auditing, false-transfer tracking, and escalation statistics. Call playback when recording is enabled for the tenant (`ENABLE_CALL_ASSIST_RECORDING`).

### Line 20 — Analytics — **PARTIAL**

Dashboards for answer/handle time, AI containment, transfer rate, caller satisfaction (survey), abandonment, language usage, incident types, and geographic heat-map hooks. Heat maps and peak-demand views require live volume and geocodes after go-live.

### Line 21 — Administrative Features — **FULL**

Administrators (or support personnel assisting them) can adjust AI prompts, configure workflows and routing rules, configure call priorities, update FAQs / knowledge, manage external transfer directories, and manage retention / records-request settings.

### Line 22 — Performance Metrics — **PARTIAL**

Architecture targets high availability on multi-AZ AWS (Lambda, DynamoDB, Connect) with 24×7 platform monitoring. **Contractual** figures (99.99% uptime, &lt;2s AI response, &lt;500 ms API latency, 95% transcription / location accuracy, RPO 15 minutes, DR &lt;4 hours) are established only in a signed Exhibit / SOW after pilot measurement — not asserted as unvalidated guarantees in this Scope.

### Line 23 — Training — **COMPLIANT (services)**

Administrator, supervisor, call taker, and technical training; CJIS-awareness documentation for product use; refresher and train-the-trainer as scoped in the SOW. See [06-implementation-kcpd-overlay.md](./06-implementation-kcpd-overlay.md).

### Line 24 — Implementation — **COMPLIANT (services)**

Named project manager, schedule, testing plan, UAT, parallel operations, cutover, rollback, go-live support, and post-implementation review. CAD write-back and live RMS are separate workstreams. See [06-implementation-kcpd-overlay.md](./06-implementation-kcpd-overlay.md) and [../implementation-and-transition.md](../implementation-and-transition.md).

### Line 25 — Maintenance — **COMPLIANT (services)**

24×7 technical support per Support Model, named account manager, software updates, security patches, quarterly business reviews, and annual health checks as scoped in the SOW.

### Line 26 — Vendor Qualifications — **PARTIAL**

Offeror will provide current United States public-safety / PSAP references on the Reference Information Sheet. Multi-CAD portability and a live scenario-based demonstration (scripted Call Assist demo library aligned to KCPD scenarios) are included. Population-size and years-in-market claims will match **actual** commercial history — not inflated for scoring.

---

## 3. Live demonstration commitment

Per the solicitation, Offeror will demonstrate:

- System overview  
- Multiple mock non-emergency calls (e.g., abandoned vehicle, noise, theft, parking, suspicious person, welfare check)  
- Language / translation path  
- Non-emergency → emergency recognition and transfer  
- Transcript, call-class, and incident-type accuracy for scoring  
- Supervisor oversight and CAD review packet (write-back gated)

Demonstration method follows the Department’s evaluation setting. A scripted demo runner exercises the same Safety, Triage, and Intake engines that sit on a production DID after telephony UAT.

---

## 4. External agency transfers

Call Assist identifies and warm-transfers calls outside KCPD when configured (e.g., 311, Parks, Water, and other directory entries). Exact numbers and hours are tenant-administered.

---

## 5. Assumptions and agency responsibilities

| Area | Agency / partner owns |
|------|------------------------|
| 911 CPE, SIP trunks, queues, overflow, certified TTY | Department telephony |
| PremierOne API credentials, sandbox, field mapping | Department + Motorola PS |
| Language Line / interpreter SOP | Department |
| Online reporting URLs and policy | Department |
| CJIS Security Addendum, personnel screening | Department + Offeror legal |
| Non-emergency DID routing into Connect | Department + telephony partner |

---

## 6. Document control

| Field | Value |
|-------|-------|
| Source matrix | `packages/shared/src/call-assist/bid-matrix.ts` |
| Date | 2026-09-27 |
| Solicitation | 2026-0010 Addendum 4 |
