export type BidLinePosition = "FULL" | "PARTIAL" | "N_A" | "COMPLIANT";

export type CallAssistBidLine = {
  line: number;
  requirement: string;
  position: BidLinePosition;
  notes: string;
};

/** KCPD RFP 2026-0010 Addendum 4 — proposal scope-of-services map. */
export const CALL_ASSIST_BID_LINE_MATRIX: readonly CallAssistBidLine[] = [
  {
    line: 1,
    requirement: "AI Call Answering",
    position: "FULL",
    notes: "Non-emergency only. Emergency immediately transfers; AI does not continue.",
  },
  { line: 2, requirement: "Call Intake", position: "FULL", notes: "Structured intake plus dynamic questioning." },
  {
    line: 3,
    requirement: "Incident Classification",
    position: "FULL",
    notes: "Duplicate detection, repeat caller, chronic location, officer safety via CAD hazards.",
  },
  {
    line: 4,
    requirement: "AI-Assisted Call Triage",
    position: "FULL",
    notes: "13 classifications; emergency always overrides.",
  },
  {
    line: 5,
    requirement: "Advanced AI Capabilities",
    position: "PARTIAL",
    notes: "Deterministic NLP + optional Bedrock later. Sentiment/voice-emotion models are not live in v1.",
  },
  {
    line: 6,
    requirement: "Language Support",
    position: "PARTIAL",
    notes: "English + Spanish heuristics; interpreter bridge is tenant config. TTY via Connect attributes + SMS fallback.",
  },
  {
    line: 7,
    requirement: "Multichannel Communications",
    position: "PARTIAL",
    notes: "Voice session + SMS links. Video attaches to existing RC live video; not a new video stack.",
  },
  {
    line: 8,
    requirement: "Callback Features",
    position: "PARTIAL",
    notes: "Callback number capture and after-hours offer. Automated outbound campaign not included in v1.",
  },
  {
    line: 9,
    requirement: "Self-Service Options",
    position: "FULL",
    notes: "Online report / CARFAX eligibility + SMS link when tenant URL is configured.",
  },
  {
    line: 10,
    requirement: "Knowledge Base",
    position: "FULL",
    notes: "Agency-managed articles with never-fabricate grounding.",
  },
  {
    line: 11,
    requirement: "Motorola CAD Integration",
    position: "PARTIAL",
    notes: "CADProvider + MotorolaPremierOneAdapter. Live push is dual fail-closed until write-back is authorized.",
  },
  { line: 12, requirement: "(Deleted in Addendum)", position: "N_A", notes: "Line removed per addendum." },
  {
    line: 13,
    requirement: "Telephony Integration",
    position: "PARTIAL",
    notes:
      "Amazon Connect webhook + contact-flow actions. SIP/VoIP CPE, ANI/ALI display, queue management, and overflow routing are tenant telephony — not a Rapid Cortex 911 phone-system replacement.",
  },
  {
    line: 14,
    requirement: "RMS Integration",
    position: "PARTIAL",
    notes: "RMSProvider interface + fail-closed drafts. Live Motorola Records filing is not enabled.",
  },
  {
    line: 15,
    requirement: "GIS Integration",
    position: "PARTIAL",
    notes: "Caller-stated location + optional RapidSOS candidate. Address validation, geocoding, jurisdiction lookup, and zone assignment are not a live GIS product in v1.",
  },
  {
    line: 16,
    requirement: "CJIS Requirements",
    position: "FULL",
    notes: "Existing RC MFA, encryption, RBAC, audit. Call Assist emits additional audit types.",
  },
  {
    line: 17,
    requirement: "Cybersecurity",
    position: "FULL",
    notes: "Existing WAF, Secrets Manager, tenant isolation. Webhook authenticates via secret ARN.",
  },
  {
    line: 18,
    requirement: "Data Retention",
    position: "FULL",
    notes: "RetentionPolicy is tenant config. A statute display name (e.g. Missouri Sunshine Law) is seed data, not engine logic.",
  },
  {
    line: 19,
    requirement: "Quality Assurance",
    position: "PARTIAL",
    notes: "Session transcript + supervisor monitor. Dedicated AI transcript scoring, keyword search, call playback, false-transfer tracking, and escalation-statistics dashboards are not in v1.",
  },
  {
    line: 20,
    requirement: "Analytics",
    position: "PARTIAL",
    notes: "Session counts, transfer rates, survey scores. Full heat-map analytics suite is not in v1.",
  },
  {
    line: 21,
    requirement: "Administrative Features",
    position: "FULL",
    notes: "Config, routing, external agencies, knowledge, retention, records requests.",
  },
  {
    line: 22,
    requirement: "Performance Metrics",
    position: "PARTIAL",
    notes: "Architecture on Lambda/Dynamo/Connect. 99.99% is a platform target, not a Call Assist SLA claim.",
  },
  { line: 23, requirement: "Training", position: "COMPLIANT", notes: "Deployment-team deliverable, not product code." },
  { line: 24, requirement: "Implementation", position: "COMPLIANT", notes: "PM/UAT/cutover is services, not product code." },
  { line: 25, requirement: "Maintenance", position: "COMPLIANT", notes: "Existing RC support model." },
  {
    line: 26,
    requirement: "Vendor Qualifications",
    position: "COMPLIANT",
    notes: "Live demo via seeded scenario runner; multi-CAD portability via CADProvider.",
  },
];
