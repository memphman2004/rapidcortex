# Portal supplier notes — paste per Bid Line

Copy each block into the Line Item **Supplier Notes** field (or attach this sheet). Do **not** mark Line 12 as a priced bid — use No Bid / N/A.

| Line | Position | Supplier notes (paste) |
|------|----------|------------------------|
| 1 | PARTIAL | NexCort iQ Call Assist: non-emergency conversational AI (Connect+Lex) with emergency hard-stop transfer, barge-in, grounding, disclosure. Not a 911 CPE replacement; DID cutover after telephony UAT. |
| 2 | FULL | Structured intake + dynamic questioning for type, location, apt/business, cross streets, DOT, vehicle, plate, suspect, weapons, injuries, contact, callback, language. |
| 3 | PARTIAL | CAD nature/priority recommendations; duplicate/repeat/chronic session signals. Live PremierOne nearby/hazards after Motorola UAT — not claimed live on Day 1. |
| 4 | FULL | Thirteen triage classes including emergency override, report-only, information, online/CarFax (KCPD online vehicle reporting) eligibility. |
| 5 | PARTIAL | NLP/LLM, sentiment, Contact Lens/Comprehend distress path, confidence, intent, summarization, dynamic Q. Continuous learning is admin-gated QA→prompt — not silent production learning. |
| 6 | PARTIAL | EN/ES first-class; more locales tenant-configurable; interpreter bridge via tenant SOP. TTY = Connect attrs + SMS fallback, not certified 911 TTY CPE. |
| 7 | PARTIAL | Voice primary; SMS self-service links; video via existing NexCort iQ live video when enabled. |
| 8 | PARTIAL | Callback capture + after-hours/overflow offer; Connect outbound campaign when instance/flow/CID configured (fail-closed otherwise). |
| 9 | FULL | Online report / CARFAX eligibility routing + FAQ information from knowledge base. |
| 10 | FULL | Agency knowledge base with never-fabricate grounding; directory transfers. |
| 11 | PARTIAL | PremierOne + multi-CAD adapters; dual fail-closed write gates. Phase 1 human-reviewed packet; Phase 2 live create after signed addendum + UAT. CAD-agnostic if Department leaves Motorola. |
| 12 | N/A | **No Bid.** RapidSOS removed per addendum/Q&A. |
| 13 | PARTIAL | Amazon Connect + ANI/ALI attributes. CPE, SIP switch, queues, overflow remain Department telephony. |
| 14 | PARTIAL | Motorola Records interface; live filing fail-closed until project enablement. |
| 15 | PARTIAL | Location capture + optional geocode/zone enrichment. Not full GIS console; accuracy measured in UAT. |
| 16 | PARTIAL | CJIS-aligned MFA, encryption, RBAC, audit. Not CJIS certification. See cybersecurity pack. |
| 17 | PARTIAL | WAF, Secrets Manager, tenant isolation, monitoring/IR. ITSU engagement welcome. 24×7 SOC only if support upgrade purchased. |
| 18 | FULL | Tenant retention, legal hold, export formats, audit chain of custody; Missouri Sunshine seed defaults — Department policy controls. |
| 19 | FULL | QA suite: transcript review, scoring, keyword search, false-transfer/escalation stats, supervisor tools; playback when recording enabled. |
| 20 | PARTIAL | AHT, containment, transfer, satisfaction, abandonment, language, incident types; heat maps after live volume. |
| 21 | FULL | Admin prompts, workflows, routing, priorities, FAQs/knowledge, retention, external agencies. |
| 22 | PARTIAL | Multi-AZ AWS architecture + 24×7 platform monitoring. Numeric SLAs only via signed Exhibit after pilot measurement. |
| 23 | COMPLIANT | Admin/supervisor/call taker/technical training; refresher; train-the-trainer per SOW. |
| 24 | COMPLIANT | PM, schedule, test plan, UAT, parallel ops, cutover, rollback, go-live, PIR per implementation overlay. |
| 25 | COMPLIANT | 24×7 support per Support Model, named AM, updates/patches, QBRs, annual health check per SOW. |
| 26 | PARTIAL | Scenario demo library + multi-CAD portability. References listed on Reference Information Sheet (actual customers only). |
