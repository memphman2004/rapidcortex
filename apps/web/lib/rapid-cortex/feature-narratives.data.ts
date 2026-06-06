/**
 * Hand-authored narrative copy for every registry feature (operator, admin, sales).
 * shortDescription is aligned with the base `description` in features.ts but may differ where noted.
 * These are merged in `features.ts`; do not use generic template filler.
 */
import type { RapidCortexFeatureExplanations } from "@/lib/rapid-cortex/features";

export const FEATURE_NARRATIVES: Record<string, RapidCortexFeatureExplanations> = {
  web_application_access: {
    shortDescription: "Browser access to dispatcher, supervisor, and admin surfaces.",
    operatorExplanation:
      "Staff sign in through the web app to handle calls, supervision, and configuration from supported browsers without installing a desktop build.",
    adminExplanation:
      "IT should enforce HTTPS, supported browser versions, SSO or Cognito policy, and session timeout to match agency security standards.",
    salesExplanation:
      "Web access is the default delivery path for pilots and production, keeping deployment friction low for floor and admin users.",
  },
  desktop_application_access: {
    shortDescription: "Native desktop entry points for operator workflows.",
    operatorExplanation:
      "Some teams prefer a native desktop shell for focus, shortcuts, or kiosk-style deployment alongside the web experience.",
    adminExplanation:
      "Package desktop apps per platform, align auto-update policy, and tie device trust and auth to your agency identity standards.",
    salesExplanation:
      "Desktop clients matter for agencies that need locked-down images or long-session stability separate from the browser.",
  },
  role_based_access_control: {
    shortDescription: "Role-scoped permissions for dispatcher, supervisor, admin, and platform roles.",
    operatorExplanation:
      "Each person only sees what their role allows (for example dispatchers versus supervisors), reducing accidental exposure and mistakes.",
    adminExplanation:
      "Map Cognito (or your IdP) roles to Rapid Cortex roles, review quarterly, and require MFA where policy demands it for admins.",
    salesExplanation:
      "Role-based access is a baseline procurement requirement for public safety: least privilege, separation of duties, and auditability.",
  },
  agency_admin_console: {
    shortDescription: "Administrative controls for users, settings, and integrations.",
    operatorExplanation:
      "Admins use this area to support day-to-day changes such as user access and integration options without code changes.",
    adminExplanation:
      "Limit admin count, log changes, and pair configuration updates with your change window and comms to floor leadership.",
    salesExplanation:
      "A dedicated admin experience helps agencies self-manage during rollout while keeping platform governance in place.",
  },
  core_reporting: {
    shortDescription: "Baseline operational reporting and trend views.",
    operatorExplanation:
      "Leaders and supervisors use core reports to see workload, throughput, and basic trends without building custom BI first.",
    adminExplanation:
      "Validate report definitions, time zones, and data retention; export may need legal review depending on your disclosure rules.",
    salesExplanation:
      "Foundational reporting helps agencies show pilot value to oversight bodies before investing in custom analytics add-ons.",
  },
  audit_logs: {
    shortDescription: "Audit trail for sensitive actions and operational controls.",
    operatorExplanation:
      "Admins and auditors can trace who changed settings or sensitive workflows when questions arise after an event.",
    adminExplanation:
      "Ensure audit shipping to your SIEM, protect log integrity, and set retention in line with policy and public records rules.",
    salesExplanation:
      "Strong auditability underpins trust with procurement, OIG, and multi-agency governance reviews.",
  },
  ai_assisted_intake: {
    shortDescription: "Assistant support during call intake to structure information faster.",
    operatorExplanation:
      "Dispatchers get prompts and structure during intake, but the human remains responsible for final decisions and CAD actions.",
    adminExplanation:
      "Configure model providers, monitor accuracy in pilot, and require audit logs; disable or narrow scope if performance drifts.",
    salesExplanation:
      "Faster, more consistent intake reduces cognitive load during high-volume periods without replacing agency procedures.",
  },
  live_transcription: {
    shortDescription: "Live transcription and transcript capture for the active session.",
    operatorExplanation:
      "The floor can read along and search recent speech to confirm details, especially in noisy or complex calls.",
    adminExplanation:
      "Pick a vetted speech provider, secure audio paths, and review retention and PII redaction in transcripts.",
    salesExplanation:
      "Transcription is table stakes for QA, training, and later analytics—if policy allows it in your jurisdiction.",
  },
  call_triage_workflows: {
    shortDescription: "Structured triage and prioritization to align intake with SOPs.",
    operatorExplanation:
      "Teams follow a consistent triage order so the highest-risk situations get attention when multiple demands compete.",
    adminExplanation:
      "Align triage questions and priorities with your protocols; update when SOPs change, and test in tabletop exercises.",
    salesExplanation:
      "Triage standardization is one of the clearest before/after measures for pilot readouts to leadership.",
  },
  call_session_history: {
    shortDescription: "Review previously handled sessions for continuity and follow-up.",
    operatorExplanation:
      "Dispatchers and supervisors can reopen past sessions to verify details, train, or support callbacks.",
    adminExplanation:
      "Scope who can see history, align retention with your records policy, and protect exports.",
    salesExplanation:
      "Session history is essential for quality programs, after-action work, and dispute resolution in quote-based programs.",
  },
  active_incident_view: {
    shortDescription: "List and details for active incidents the agency is working.",
    operatorExplanation:
      "Gives a shared view of in-progress work in Rapid Cortex; it does not alone replace the CAD of record for dispatch authority.",
    adminExplanation:
      "Label the UI clearly so staff know what is system-of-record (CAD) versus decision-support context from Rapid Cortex.",
    salesExplanation:
      "Operators need a single operational picture; Rapid Cortex can complement CAD without replacing vendor CAD workflows unless separately integrated.",
  },
  dispatcher_console: {
    shortDescription: "Primary operator console for day-to-day real-time tasks.",
    operatorExplanation:
      "Dispatchers work their primary screen for intake, media, and assistive context during live operations.",
    adminExplanation:
      "Plan seat counts, hotkey policies, and fail-over when the console is down; some Essential pilots cap concurrent advanced modules.",
    salesExplanation:
      "The console is the everyday surface agencies evaluate first—stability, clarity, and speed drive renewal conversations.",
  },
  channel_talk_group_monitoring: {
    shortDescription: "Monitoring views that tie talk groups or radio channels to incident context (where integrated).",
    operatorExplanation:
      "Supervisors or designated roles can line up radio context next to the workflow when your integration supports it.",
    adminExplanation:
      "This often needs vendor radio integration, credentials, and legal review; default off until integration is live and approved.",
    salesExplanation:
      "Agencies with heavy radio load want correlated context; scope this as a controlled add-on with clear acceptance tests.",
  },
  non_emergency_intake_queue: {
    shortDescription: "Queue for non-emergency and alternative-path requests separate from 911 life-safety triage where configured.",
    operatorExplanation:
      "Staff can work alternate queues without blocking or confusing life-safety handling when processes are defined.",
    adminExplanation:
      "Set routing rules, SLAs, and public-facing messaging; ensure workers know what belongs in the queue under policy.",
    salesExplanation:
      "Non-emergency growth is a common pain point; a dedicated queue helps cities reduce 911 load without faking priority.",
  },
  backlog_sla_tracking: {
    shortDescription: "Backlog and SLA-style metrics for intake queues and follow-ups.",
    operatorExplanation:
      "Supervisors see which items are waiting too long and can rebalance work during surge conditions.",
    adminExplanation:
      "Agree on thresholds with leadership, refresh targets when staffing changes, and avoid gaming metrics that harm safety.",
    salesExplanation:
      "Service metrics help agencies show operational improvement in procurement, especially for alt-channel programs.",
  },
  multilingual_intake: {
    shortDescription: "Multilingual support during intake, including text or voice as configured.",
    operatorExplanation:
      "Operators can work with more callers in their own language, subject to agency language-access policies and human verification.",
    adminExplanation:
      "Approve supported languages, monitor translation systems, and document limitations for your language-access program.",
    salesExplanation:
      "Diverse service areas use multilingual support as a core equity measure during intake and call-back workflows.",
  },
  live_translation: {
    shortDescription: "Translates caller or text-based communication into the operator’s working language during an active session.",
    operatorExplanation:
      "Dispatchers can understand non-English speech or chat faster, but they must still follow agency review rules for accuracy.",
    adminExplanation:
      "Requires provider credentials, approved language sets, and audit logging; monitor accuracy during pilot and adjust scope.",
    salesExplanation:
      "This reduces time-to-serve for multilingual communities when paired with clear operational guardrails, not a translation hotline replacement.",
  },
  text_to_voice_support: {
    shortDescription: "Synthesized voice for scripted prompts or read-back in supported workflows.",
    operatorExplanation:
      "Operators can play consistent voice instructions where policy allows, helping callers in the field or noisy environments.",
    adminExplanation:
      "Pick voice, rate, and content libraries; log usage and keep prompts reviewed for policy alignment.",
    salesExplanation:
      "TTS is useful for consistent procedural prompts in training-heavy or repetitive workflows once approved.",
  },
  language_auto_detection: {
    shortDescription: "Detects the caller’s language so routing and tools can follow policy.",
    operatorExplanation:
      "Reduces manual language selection when the caller is uncertain which button to use in multilingual flows.",
    adminExplanation:
      "Tune false-positive handling, audit detection usage, and ensure fallbacks to human language services where required.",
    salesExplanation:
      "Improves first-contact experience in multicultural PSAPs when paired with a managed language list and QA.",
  },
  text_based_multilingual_workflows: {
    shortDescription: "Text-first multilingual handling for silent, SMS, or chat-style paths.",
    operatorExplanation:
      "Supports people who must text for safety and teams that split voice and text in complex incidents.",
    adminExplanation:
      "Align with 911 text availability in your area, message retention, and any silent-text SOPs before promoting widely.",
    salesExplanation:
      "A practical package for programs expanding beyond voice-only, especially for domestic violence and discreet reporting.",
  },
  caller_photo_upload: {
    shortDescription: "Secure photo collection from a caller for situational context.",
    operatorExplanation:
      "Dispatchers can request still images to clarify location or hazard without claiming CAD unit locations automatically.",
    adminExplanation:
      "Turn on with chain-of-custody rules, size limits, malware scanning, and evidence retention; obtain agency approval to enable.",
    salesExplanation:
      "Photo intake helps verify scenes for LE and fire when policy allows, especially with tokenized, audited uploads.",
  },
  caller_video_upload: {
    shortDescription: "Video clip upload from callers for review by authorized users.",
    operatorExplanation:
      "Provides richer context for supervisors and training when short clips are allowed by policy, not a replacement for field video systems.",
    adminExplanation:
      "Requires clear retention, redaction, and access controls; do not over-collect; verify carrier and browser constraints in pilot.",
    salesExplanation:
      "Valuable for high-ambiguity events when evidentiary and privacy reviews are in place, often as an add-on scoping line.",
  },
  live_caller_media_streaming: {
    shortDescription: "Live streaming of caller media to authorized staff when integrated (not a substitute for field camera systems).",
    operatorExplanation:
      "Lets a narrow set of users watch a live view while maintaining operational discipline and not pretending CAD telematics are live.",
    adminExplanation:
      "Needs bandwidth, consent flows, and sometimes vendor integration; start with small pilots and clear logging.",
    salesExplanation:
      "A premium capability for special teams when governance can keep up with the evidence load.",
  },
  media_audit_trail: {
    shortDescription: "Who accessed, exported, or changed media and when.",
    operatorExplanation:
      "Supports internal investigations and public records defensibility for sensitive clips and photos.",
    adminExplanation:
      "Keep audit in immutable storage, tie to user IDs, and train staff that views may be disclosable.",
    salesExplanation:
      "Prosecution and civil oversight increasingly expect a defensible access trail for media evidence.",
  },
  retention_controls: {
    shortDescription: "Agency policy controls for how long media and related artifacts are kept.",
    operatorExplanation:
      "Ensures the platform follows your hold and purge rules instead of ad hoc deletions on the floor.",
    adminExplanation:
      "Work with legal on retention schedules, legal hold, and disaster recovery; test restores before go-live.",
    salesExplanation:
      "Buyers with strict records laws need policy-driven retention, not ad hoc storage growth.",
  },
  qa_review_tools: {
    shortDescription: "Supervisor tools to review calls or sessions and document findings.",
    operatorExplanation:
      "QA leads can score, annotate, and track follow-ups in one place, improving training loops.",
    adminExplanation:
      "Define who can see recordings, set sampling rates, and align reviews with labor agreements and privacy law.",
    salesExplanation:
      "A structured QA process is a standard deliverable in Professional+ packages for maturing operations.",
  },
  scorecards: {
    shortDescription: "Scorecards to aggregate QA scores and show trends for teams or individuals (aggregate views).",
    operatorExplanation:
      "Supervisors track improvement areas without relying on ad hoc spreadsheets when metrics are available.",
    adminExplanation:
      "Guard against using scores punitively against policy; validate metric definitions and peer calibration sessions.",
    salesExplanation:
      "Gives command staff objective trends for staffing and training investments when paired with a healthy QA culture.",
  },
  coaching_notes: {
    shortDescription: "Coaching notes tied to people or events for follow-up and growth.",
    operatorExplanation:
      "Supervisors document expectations and follow-up after QA so improvement is clear and traceable in policy-safe ways.",
    adminExplanation:
      "Decide who can read notes, how long they persist, and how they align with personnel rules.",
    salesExplanation:
      "Distinguishes a coaching culture from a punitive one—frequently required in RFPs for training-heavy centers.",
  },
  team_performance_dashboards: {
    shortDescription: "Team-level performance dashboards for workload and quality indicators.",
    operatorExplanation:
      "Shift leaders see if teams are under strain or if coaching themes emerge across a group.",
    adminExplanation:
      "Confirm metrics are aggregated appropriately and cannot identify individuals in ways that violate local rules.",
    salesExplanation:
      "Leaders use dashboards to prove ROI for staffing and to justify new programs with evidence.",
  },
  call_quality_trends: {
    shortDescription: "Longitudinal trends for call quality and QA signals where data exists.",
    operatorExplanation:
      "Shows whether coaching is moving the needle over months, not just single reviews.",
    adminExplanation:
      "Ensure time ranges match reporting periods used for oversight and be transparent about data gaps.",
    salesExplanation:
      "Narrates improvement over a pilot or contract term—helpful in executive and grant reporting.",
  },
  major_incident_management: {
    shortDescription: "Controls and context for large-scale or long-duration major incidents (ICS-style coordination, not a CAD replacement).",
    operatorExplanation:
      "Helps track multi-jurisdiction or multi-hour events without pretending CAD is controlled from Rapid Cortex unless integrated.",
    adminExplanation:
      "Set governance for who can open major mode, public affairs rules, and dependencies on radio/CAD data feeds as available.",
    salesExplanation:
      "Key for counties that routinely face wildfire, weather, or civil event surges; scope as a command package.",
  },
  command_dashboard: {
    shortDescription: "Leadership-style dashboard of incident, workload, and reliability signals the agency maps to its needs.",
    operatorExplanation:
      "Commanders get a read-only, decision-support picture; local CAD remains authoritative for resource status unless write-back is explicitly approved.",
    adminExplanation:
      "Configure what appears, who may view it, and when dashboards update; avoid over-claiming live CAD if feeds lag.",
    salesExplanation:
      "A sells story for command centers that need a common operating picture on top of existing CAD investments.",
  },
  war_rooms: {
    shortDescription: "Dedicated collaboration space for synchronized response during a major or critical event.",
    operatorExplanation:
      "Teams co-locate digitally around tasks, checklists, and context without faking real dispatch comms to the public.",
    adminExplanation:
      "Define who joins, when rooms lock, and how logs are retained for after-action and legal needs.",
    salesExplanation:
      "Often bundled for agencies running frequent multi-agency events under incident command systems.",
  },
  runbooks_playbooks: {
    shortDescription: "Runbooks and playbooks that guide response steps during incidents, editable by the agency.",
    operatorExplanation:
      "Staff follow approved steps during stress; content must stay current and approved by the authority having jurisdiction.",
    adminExplanation:
      "Version, review, and distribute changes like any policy document; do not let stale SOPs remain published.",
    salesExplanation:
      "Turns policy binders into usable digital guidance—procurement often asks for “what do we do when X happens?”.",
  },
  incident_timeline_reconstruction: {
    shortDescription: "Reconstructs a timestamped view of what happened in Rapid Cortex for a given event.",
    operatorExplanation:
      "AAR teams rebuild sequences for after-action, training, and oversight without simulating public safety response.",
    adminExplanation:
      "Align timestamps to authoritative sources (recordings, CAD if integrated); label gaps or uncertain ordering clearly.",
    salesExplanation:
      "Critical for NIMS-style reviews and for agencies defending decisions after controversial incidents.",
  },
  post_incident_reviews: {
    shortDescription: "Workflow to capture post-incident learning and corrective actions in one place.",
    operatorExplanation:
      "Structured reviews reduce informal blame cycles and make improvements actionable where leadership supports them.",
    adminExplanation:
      "Protect sensitive notes, align with labor counsel, and export only under proper authority.",
    salesExplanation:
      "Shows a maturity path from logs to real organizational learning—often upsold with command packages.",
  },
  stakeholder_status_pages: {
    shortDescription: "Curated status updates for non-operators such as Electeds or partners when approved.",
    operatorExplanation:
      "Public affairs can share a controlled view without over-sharing tactical details, using approved messaging only.",
    adminExplanation:
      "Set approval chains, PII redaction, and when pages auto-expire; never present simulated CAD states as live.",
    salesExplanation:
      "Valuable for regional events where external stakeholders need a trustworthy narrative, not a feed of secrets.",
  },
  monitoring_integrations: {
    shortDescription: "Connect metrics and health from external systems into a unified operational view (where enabled).",
    operatorExplanation:
      "Ops and IT see that dependent services and integrations are healthy before peak volume hits.",
    adminExplanation:
      "Store credentials in Secrets Manager, scope least-privilege API keys, and test paging paths during business hours first.",
    salesExplanation:
      "Makes uptime conversations concrete for CIOs and helps justify SRE or managed services lines.",
  },
  alert_correlation: {
    shortDescription: "Group related alerts to reduce noise during incidents and maintenance.",
    operatorExplanation:
      "During storms of alerts, the team can focus on root causes instead of every duplicate page.",
    adminExplanation:
      "Tune correlation rules, ownership of dedupe logic, and ensure missed alerts are tracked as risks.",
    salesExplanation:
      "A Command-tier theme for 24/7 operations centers already running complex observability stacks.",
  },
  escalation_engine: {
    shortDescription: "Rule-based escalations to on-call and leadership for defined failure or surge conditions (not 911 call routing).",
    operatorExplanation:
      "IT and ops are notified in order when the platform or integrations breach thresholds, separate from 911 call-taking.",
    adminExplanation:
      "Document escalation steps, on-call rosters, and how they interact with your county-wide comms; test quarterly.",
    salesExplanation:
      "Gives risk officers confidence that product incidents won’t languish unseen overnight.",
  },
  on_call_routing: {
    shortDescription: "On-call handoffs for the Rapid Cortex service team or integrated paging targets as configured (not 911 ACD).",
    operatorExplanation:
      "Designated people receive alerts through approved channels; this is not a substitute for public emergency call distribution.",
    adminExplanation:
      "Integrate with PagerDuty/Opsgenie-style tools when needed; keep vendor secrets off clients.",
    salesExplanation:
      "Paired with enterprise support contracts to meet uptime expectations in procurement.",
  },
  slo_dashboards: {
    shortDescription: "SLO/SLA-style dashboards for service health where metrics are available.",
    operatorExplanation:
      "Leadership can see if customer-facing latency or error budgets are trending the wrong way before users flood the help desk.",
    adminExplanation:
      "Define SLOs with the vendor, align with contracts, and avoid publishing internal targets publicly without approval.",
    salesExplanation:
      "Evidences service maturity for RFPs that ask for measurable reliability commitments.",
  },
  reliability_reporting: {
    shortDescription: "Reliability and incident report packs for reviews with IT and leadership.",
    operatorExplanation:
      "Summarizes what broke, for how long, and what was done, after vendor incidents and drills.",
    adminExplanation:
      "Distribute to security committee; redact customer-specific details in shared versions.",
    salesExplanation:
      "Commonly used in year-end renewals to show operational seriousness.",
  },
  standard_onboarding: {
    shortDescription: "Included onboarding playbooks, training slots, and cutover support within standard scope.",
    operatorExplanation:
      "Teams know what to expect in week one, who trains whom, and how support channels work during go-live.",
    adminExplanation:
      "Assign an internal product owner, schedule floor time, and keep vendor tasks unblocked to hit dates.",
    salesExplanation:
      "Makes the quote real—without onboarding, new software does not make it to sustained use on the floor.",
  },
  premium_onboarding: {
    shortDescription: "Expanded onboarding, hypercare windows, and deeper hands-on support during go-live and stabilization.",
    operatorExplanation:
      "Extra vendor presence for tough cutovers, complex integrations, or multi-site coordination.",
    adminExplanation:
      "Budget staff time, secure exec sponsorship, and align hypercare with major events calendar.",
    salesExplanation:
      "Often priced for command rollouts and agencies replacing legacy call-handling stacks.",
  },
  integration_assistance: {
    shortDescription: "Engineering and solution support for third-party and CAD-adjacent integrations (vendor-specific).",
    operatorExplanation:
      "Your workflows connect to the systems you already run—no promise of out-of-the-box behavior without discovery.",
    adminExplanation:
      "Provide vendor contacts, test environments, and security reviews; expect phased milestones and acceptance tests.",
    salesExplanation:
      "Integration risk is a top procurement fear; this line item shows you will not leave the agency to wire it alone.",
  },
  priority_support: {
    shortDescription: "Faster support response and escalation paths for production issues compared to standard.",
    operatorExplanation:
      "The floor and IT can reach a trained responder with clearer SLAs when the product is down or degraded.",
    adminExplanation:
      "Validate hours of coverage, holiday handling, and how you page Rapid Cortex in emergencies.",
    salesExplanation:
      "Common upsell for 24/7 agencies that cannot wait for next-business-day email for outage-class problems.",
  },
  dedicated_rollout_planning: {
    shortDescription: "Dedicated project management and rollout milestones across sites or phases (contract-scoped).",
    operatorExplanation:
      "A named plan coordinates training waves, UAT, and go-live with clear owners on both sides.",
    adminExplanation:
      "Assign a single internal rollout lead, secure union/calendar buy-in, and keep risks visible weekly.",
    salesExplanation:
      "Sells to agencies that failed past IT rollouts without enough coordination muscle.",
  },
  multi_site_deployment_support: {
    shortDescription: "Playbooks and support for more than one PSAP, campus, or region under one program.",
    operatorExplanation:
      "Ensures all sites are not on different ad hoc configs that break when data must be shared or compared.",
    adminExplanation:
      "Standardize config templates, data residency, and comms; plan regional differences explicitly.",
    salesExplanation:
      "A must-have for countywide, statewide, and regional procurements; rarely optional at enterprise tier.",
  },
  custom_security_compliance_review: {
    shortDescription: "CJIS-aligned and procurement-grade security and compliance review documentation (not a certification claim on its own).",
    operatorExplanation:
      "Gives your infosec and policy teams a clear picture of how Rapid Cortex maps to expected controls, without claiming a certification the product has not earned.",
    adminExplanation:
      "Security and legal teams map controls, gaps, and compensating steps; you still own the ATO/approval path and CJIS program responsibilities.",
    salesExplanation:
      "Helps large agencies de-risk the contract when IT asks for evidence on paper for sensitive deployments.",
  },
  cad_disabled_mode: {
    shortDescription: "Operate Rapid Cortex with no direct CAD data feed—assisted workflows only, no live CAD state.",
    operatorExplanation:
      "Staff get intake and AI assist without any assertion of reading or writing the CAD; safest default in early pilots.",
    adminExplanation:
      "Keep `CAD_INTEGRATION_MODE=disabled` until you have contracts, data agreements, and testing plans with your CAD vendor.",
    salesExplanation:
      "A legitimate starting state that sets expectations: the product can help calls without any CAD project yet.",
  },
  cad_discovery_workshop: {
    shortDescription: "Workshop to map your CAD, radio, and data flows and define integration scope with vendors.",
    operatorExplanation:
      "Aligns public safety, IT, and your CAD vendor on what is technically possible, legal, and supportable (no live wiring yet).",
    adminExplanation:
      "Bring the right signatories, network diagrams, and NDA; outcomes feed SOW, not a promise of go-live date.",
    salesExplanation:
      "Reduces expensive rework by surfacing “unknown unknowns” before build versus after cutover failure.",
  },
  cad_read_only_integration: {
    shortDescription: "Read selected CAD or RMS fields into Rapid Cortex for context only, no write-back to CAD from this product path.",
    operatorExplanation:
      "Dispatchers can see a structured snapshot where integrated; they still work primary CAD in the vendor UIs for dispatch authority.",
    adminExplanation:
      "Scope allowed fields, rate limits, and logs; this mode should stay default until read-only is stable in pilot.",
    salesExplanation:
      "Most agencies start read-only: lower risk, faster to harden, and no dispatch-by-proxy confusion.",
  },
  cad_assisted_writeback: {
    shortDescription: "Draft CAD updates in Rapid Cortex, then require explicit human approval in controlled flows before a vendor path sends data.",
    operatorExplanation:
      "Never implies silent CAD updates—human review and an approved path per agency policy, with dispatcher attestation in the product flow as configured.",
    adminExplanation:
      "Requires `CAD_INTEGRATION_MODE=assisted_writeback`, `CAD_WRITEBACK_ENABLED`, agency attestation, field mapping sign-off, and audit trail.",
    salesExplanation:
      "Where agencies want to reduce double-entry, assisted write shows ROI while keeping a human in the middle.",
  },
  cad_automated_writeback: {
    shortDescription: "Vendor-specific automated path to post updates to CAD under strict gating; blocked in default configurations.",
    operatorExplanation:
      "Even when enabled, your agency and vendor must explicitly accept automation; never treated as a demo toy.",
    adminExplanation:
      "Blocked by product defaults: requires high governance, error budgets, rollback plans, and usually enterprise agreements.",
    salesExplanation:
      "Rare, highly governed option—pitch cautiously, only with references and vendor proof points.",
  },
  cad_vendor_adapter: {
    shortDescription: "Adapter layer for a specific CAD vendor’s APIs or SDK, behind the common Rapid Cortex CAD interface.",
    operatorExplanation:
      "Staff should not need to know adapter details—success looks like “CAD fields appear when configured.\"",
    adminExplanation:
      "Plan budget for vendor T&M, test tenants, and upgrade cadence; adapters follow vendor API changes.",
    salesExplanation:
      "Makes the sale credible: you are not claiming one universal CAD, you are scoping a concrete adapter program.",
  },
  cad_field_mapping: {
    shortDescription: "Agency-approved field mapping and validation rules for what can be read and written to CAD (when any write is allowed).",
    operatorExplanation:
      "Reduces the chance of the wrong data landing in a CAD field during stressful operations.",
    adminExplanation:
      "Joint sign-off with CAD admin; treat mappings like schema migrations with regression tests, not a spreadsheet alone.",
    salesExplanation:
      "A deliverable in serious CAD programs—RFPs often list field mapping and acceptance tests explicitly.",
  },
  cad_audit_logging: {
    shortDescription: "Capture CAD-related reads, drafts, and write attempts in your audit and operations logs (where the platform supports it).",
    operatorExplanation:
      "Gives a defensible record when an investigation asks “what did the system show or try to do about CAD?”.",
    adminExplanation:
      "Must be on for any write plan; connect logs to your SIEM and set retention; never disable to “go faster.\"",
    salesExplanation:
      "A non-negotiable line item in oversight-heavy jurisdictions; pair with AAR and legal support.",
  },
  cad_rollback_plan: {
    shortDescription: "Tested plan to back out or quarantine a CAD connector or write path without losing operational clarity.",
    operatorExplanation:
      "If a connector misfires, the agency knows the immediate comms, staffing, and manual CAD steps to take.",
    adminExplanation:
      "Tabletop the rollback with CAD vendor and IT, document owner and triggers, and run `/api/cad/rollback-test` in sandbox.",
    salesExplanation:
      "Shows you take cutover risk seriously; common in RFPs that lived through a bad integration in the last decade.",
  },
  livelocation_secure_caller_share: {
    shortDescription: "SMS time-limited secure link so callers can share approved GPS context with an incident.",
    operatorExplanation:
      "Dispatchers generate a link that opens a consent-first page; location history and accuracy display in Rapid Cortex when callers opt in and policy allows SMS delivery.",
    adminExplanation:
      "Coordinate lawful SMS policies, archiving, Secrets Manager SMS credentials, and ENABLE_PINPOINT gating across web and API.",
    salesExplanation:
      "Differentiates tactical caller locate workflows from speculative AI claims—it is audited, dispatcher-initiated cooperation.",
  },
  surge_view_related_calls: {
    shortDescription: "Cluster related near-simultaneous incidents using proximity, time, language overlap, call type cues, and location hints.",
    operatorExplanation:
      "Supervisors can review grouped calls during weather, roadway, or coordinated events instead of juggling dozens of near-duplicate tickets manually.",
    adminExplanation:
      "Requires ENABLE_SURGE and trained supervision to interpret heuristic scores; clustering is advisory, never automatic dispatch routing.",
    salesExplanation:
      "Honest story: heuristic duplicate-call grouping for situational clarity, not mystical predictive hotspots unless your agency later layers analytics.",
  },
  operational_maps_mapbox: {
    shortDescription: "Dark-theme embedded Mapbox views aligned with Rapid Cortex command surfaces.",
    operatorExplanation:
      "Caller-shared pins or incident overlays render on workspace maps alongside future CAD overlays when integrations feed data.",
    adminExplanation:
      "Provision Mapbox tokens with least-priv scopes, audit what layers are toggled externally, and plan offline fallbacks.",
    salesExplanation:
      "Shows visual parity with legacy blue-light GIS expectations while keeping renders inside hardened web shells.",
  },
  cad_delivery_latency_profiles: {
    shortDescription: "Vendor-variable CAD ingestion pacing (polling, webhooks, or streaming) negotiated per deployment.",
    operatorExplanation:
      "Supervisors sometimes see tighter refresh when vendors expose push paths; latency still depends on RMS contracts and WAN health.",
    adminExplanation:
      "Document ingestion mode, backoff, alerting, and test harnesses alongside CAD vendor—not a SKU-level SLA number without measurement.",
    salesExplanation:
      "Counters impossible “always 50 ms CAD” chatter by framing realistic integration engineering scope.",
  },
  cad_map_unit_overlay: {
    shortDescription: "Unit/Apparatus symbology on maps whenever CAD or AVL positions are contractually forwarded.",
    operatorExplanation:
      "Markers populate only after feeds reconcile; supervisors should never assume coverage without validating AVL completeness.",
    adminExplanation:
      "Align field mapping with CAD GIS teams, purge stale tracks, and log access to positional data streams.",
    salesExplanation:
      "Communicates phased AVL rollout instead of implying every municipality instantly tracks every apparatus.",
  },
  primary_ai_model: {
    shortDescription: "Primary model path for triage, summarization, and assistive text where configured (decision support only).",
    operatorExplanation:
      "Provides the first-pass model responses your agency approved for scope and safety reviews.",
    adminExplanation:
      "Lock provider, region, and key management; log prompts/responses with policy-safe metadata only.",
    salesExplanation:
      "A baseline for modern PSAP RFPs that ask for AI, but you still sell governance, not magic.",
  },
  secondary_ai_model_review: {
    shortDescription: "Secondary model or reviewer path to cross-check or enrich critical outputs (where enabled).",
    operatorExplanation:
      "Gives a second look on sensitive automation where policy demands redundancy or your risk team asked for it.",
    adminExplanation:
      "Has cost and latency tradeoffs; set when it runs, and do not over-trigger on every routine line.",
    salesExplanation:
      "A trust builder for large counties considering liability from single-model errors.",
  },
  tertiary_ai_model_fallback: {
    shortDescription: "Tertiary fallback for degraded provider outages or throttling, not a second opinion on every call.",
    operatorExplanation:
      "Helps the floor keep partial assistance during vendor incidents instead of a hard off-switch.",
    adminExplanation:
      "Define which features degrade, human-only fallbacks, and when to show “assist unavailable.\"",
    salesExplanation:
      "Highlights resilience in enterprise deals where any downtime is front-page news.",
  },
  ai_confidence_scoring: {
    shortDescription: "Shows confidence metadata on AI output so users know when to double-check (where implemented).",
    operatorExplanation:
      "Dispatchers and supervisors can pause or escalate when the model is unsure—useful during pilot tuning.",
    adminExplanation:
      "Validate UI thresholds; avoid hiding confidence from staff who are accountable for the decision.",
    salesExplanation:
      "A practical answer to “How do I trust the AI?” in procurement demos.",
  },
  ai_incident_summarization: {
    shortDescription: "Generates a draft summary for human review, not a public release without approval.",
    operatorExplanation:
      "Speeds handoffs and AARs by drafting narrative text from session context with human sign-off for external use.",
    adminExplanation:
      "Suppress PII, align tone with your PA office, and log usage for oversight bodies.",
    salesExplanation:
      "A concrete AI win that is easier to show in pilots than “general intelligence.\"",
  },
  ai_dispatcher_recommendation_engine: {
    shortDescription: "Suggests next steps, clarifying questions, or checklists; never autonomously dispatches resources in place of a human.",
    operatorExplanation:
      "Supports structured thinking; staff remain accountable to agency protocol and local CAD for resource assignment.",
    adminExplanation:
      "Tune prompts, disable high-risk suggestions, and log outcomes for model governance meetings.",
    salesExplanation:
      "Sells as cognitive load reduction, not autonomous dispatch, which keeps legal review simpler.",
  },
  custom_agency_ai_prompts: {
    shortDescription: "Agency-scoped prompt templates and guardrails instead of a single global script.",
    operatorExplanation:
      "Allows language and SOP to match your county without developers editing code for every tweak.",
    adminExplanation:
      "Require C-level or delegated approval, version control, and regression tests after any prompt change.",
    salesExplanation:
      "Enterprise buyers expect tenant-specific language and local legal sensitivity—this line maps to that.",
  },
  custom_emergency_workflow_tuning: {
    shortDescription: "Tuning dials for triage, routing suggestions, and workflow emphasis within your approved emergency protocols.",
    operatorExplanation:
      "Aligns the assistant with your priority schemes without pretending to be your CAD or radio system.",
    adminExplanation:
      "Coordinate with your protocol medical director, fire chief, or PD policy units before any change; document rationale.",
    salesExplanation:
      "Shows professional services value when each agency is unique but still needs a safe baseline.",
  },
  ai_qa_scoring: {
    shortDescription: "AI-suggested rubric or hints for scoring QA reviews where enabled and where policy allows (human decides).",
    operatorExplanation:
      "Supervisors may save time on routine scoring, but they still own final grades and comments.",
    adminExplanation:
      "Start with a narrow rubric, bias-test against protected classes, and allow appeal paths.",
    salesExplanation:
      "A talking point to reduce manual QA time while underscoring human final authority.",
  },
  ai_post_incident_review: {
    shortDescription: "AI support for post-incident drafts, timelines, or checklist gaps under human sign-off (not a replacement for AAR).",
    operatorExplanation:
      "AAR teams get a first pass of themes and follow-ups, then edit for accuracy and sensitivity.",
    adminExplanation:
      "Restrict distribution of drafts; align with public records, union rules, and criminal justice data limits.",
    salesExplanation:
      "Makes the command package feel modern while steering clear of “AI autopsy” overclaims.",
  },
  secrets_manager_integration: {
    shortDescription: "Store API keys and integration secrets in AWS Secrets Manager (or equivalent) instead of in code or the browser.",
    operatorExplanation:
      "Reduces the chance a credential leak on a workstation compromises CAD or AI vendor accounts.",
    adminExplanation:
      "Use least-priv IAM, rotation policies, and break-glass procedures; no secrets in public env files.",
    salesExplanation:
      "Standard expectation for public-sector security questionnaires.",
  },
  cloudwatch_logging: {
    shortDescription: "Operational and application logs in CloudWatch for monitoring and support (with sanitization).",
    operatorExplanation:
      "Faster support when something breaks, without exposing call content broadly in log streams.",
    adminExplanation:
      "Tune retention, set log metric filters, and block sensitive payload logging by policy.",
    salesExplanation:
      "A checkbox item in technical RFPs that also speeds incident resolution in practice.",
  },
  audit_event_trail: {
    shortDescription: "Product-level audit events for security and compliance (distinct from but related to your CAD audit).",
    operatorExplanation:
      "Supports “who did what in Rapid Cortex” for investigations, separate from voice recordings.",
    adminExplanation:
      "Map events to your GRC tool; define who may export audit logs and how chain-of-custody works.",
    salesExplanation:
      "Often a minimum viable requirement to pass infosec review before pilot.",
  },
  data_retention_policy_controls: {
    shortDescription: "Policy-driven settings for data retention, holds, and deletion aligned with your legal framework.",
    operatorExplanation:
      "Ensures day-to-day use cannot silently defeat records retention the county attorney required.",
    adminExplanation:
      "Partner with legal on schedules, hold triggers, and discovery exports; test deletes in non-prod first.",
    salesExplanation:
      "A major theme in RFPs where evidence handling is regulated or politically sensitive.",
  },
  role_based_permissions: {
    shortDescription: "Enforce what each role can do inside Rapid Cortex, mapped from your directory or Cognito groups.",
    operatorExplanation:
      "Same concept as broader RBAC but specific to in-app operations like exporting or config changes.",
    adminExplanation:
      "Reconcile with HR role changes, terminations, and break-glass admin accounts; review quarterly.",
    salesExplanation:
      "A twin sell with org-wide RBAC—here we mean application-level enforcement.",
  },
  tenant_isolation: {
    shortDescription: "Store and enforce agency boundaries so one tenant’s data and settings do not leak to another’s.",
    operatorExplanation:
      "Gives each agency confidence their incident data is not intermixed with a neighbor in multi-tenant clouds.",
    adminExplanation:
      "For statewide hosts, test cross-tenant access attempts, pen-test boundaries, and document isolation in diagrams.",
    salesExplanation:
      "A requirement for any hosting deal where multiple cities share a platform.",
  },
  production_secret_validation: {
    shortDescription: "Pre-flight checks that required secrets, endpoints, and keys exist before you mark production go-live (fail closed on gaps).",
    operatorExplanation:
      "Gives the floor and IT a shared, objective go-live gate instead of a verbal “we think it is fine.\"",
    adminExplanation:
      "Run the readiness check before UAT sign-off; treat failures as go/no-go, not a warning banner.",
    salesExplanation:
      "Turns a scary black box go-live into a checklist leadership can read before signing the cutover plan.",
  },
  standard_support: {
    shortDescription: "Standard vendor support for production issues and general guidance during business terms (per contract).",
    operatorExplanation:
      "A known channel when something breaks, with expectations documented up front, not a blank email inbox.",
    adminExplanation:
      "Know your entitlements, hours, and escalation; assign internal comms to avoid duplicate tickets.",
    salesExplanation:
      "The baseline to compare against mission or priority add-ons in proposals.",
  },
  priority_support_package: {
    shortDescription: "Faster, named SLAs and escalation compared to standard support (contracted).",
    operatorExplanation:
      "Front-line and IT can move incidents forward when minutes matter, within agreed windows.",
    adminExplanation:
      "Validate coverage windows against your 24/7 floor; align paging so vendor responses reach a human.",
    salesExplanation:
      "A frequent upsell to regional centers that cannot treat outages as “wait until morning.”",
  },
  mission_support_package: {
    shortDescription: "High-touch support for high-criticality or multi-agency programs with stricter comms and senior escalation.",
    operatorExplanation:
      "During major regional events, you can reach a senior engineer path when contractually engaged.",
    adminExplanation:
      "Define in writing what constitutes “mission” vs a normal SEV, and how to avoid abuse of the line.",
    salesExplanation:
      "A premium line item for OOG-style coordination agencies or state fusion centers in scope.",
  },
  dedicated_support_engineer: {
    shortDescription: "Named or pooled dedicated engineer for ongoing technical relationship (contracted).",
    operatorExplanation:
      "Less re-explaining your environment to a new person every ticket, within scope.",
    adminExplanation:
      "Document a steering cadence, backlog, and out-of-hours expectations so both sides are aligned.",
    salesExplanation:
      "Often sold in enterprise deals where churn on the vendor side would be politically unacceptable.",
  },
  dedicated_customer_success_manager: {
    shortDescription: "A customer success manager to align product adoption, value tracking, and expansion planning (contracted).",
    operatorExplanation:
      "Champions training completion, new module readiness, and executive readouts to keep momentum after go-live.",
    adminExplanation:
      "Assign an internal single owner; success managers cannot substitute for 911 policy decisions.",
    salesExplanation:
      "A procurement-friendly role that signals long-term partnership rather than a one-time install.",
  },
  dedicated_solution_architect: {
    shortDescription: "An architect to map integrations, data flows, and multi-site topologies, especially with CAD and identity.",
    operatorExplanation:
      "Helps your IT and the vendor build the same mental model and reduce nasty surprises in cutover week.",
    adminExplanation:
      "Bring your network, identity, and CAD teams into architecture sessions; decisions here drive cost and time.",
    salesExplanation:
      "Differentiates your proposal on complex, multi-year statewide programs.",
  },
};
