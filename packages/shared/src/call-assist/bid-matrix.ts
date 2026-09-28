export type BidLinePosition = "FULL" | "PARTIAL" | "N_A" | "COMPLIANT";

export type CallAssistBidLine = {
  line: number;
  requirement: string;
  position: BidLinePosition;
  notes: string;
};

/**
 * KCPD RFP 2026-0010 Addendum 4 — proposal scope-of-services map.
 *
 * Honesty gate: paste into Scope of Services only as-is. Do not upgrade PARTIAL → FULL
 * for CAD write, telephony CPE, RMS, GIS, SLAs, or vendor quals without live UAT evidence.
 * Last redlined against Call Assist adapters + demo playbook (2026-09-27).
 */
export const CALL_ASSIST_BID_LINE_MATRIX: readonly CallAssistBidLine[] = [
  {
    line: 1,
    requirement: "AI Call Answering",
    position: "PARTIAL",
    notes:
      "Non-emergency Lex/Connect path with emergency hard-stop transfer, barge-in, grounding, disclosure. Live DID requires un-mocked Connect+Lex and agency telephony UAT — not a sole-prime CPE replacement.",
  },
  { line: 2, requirement: "Call Intake", position: "FULL", notes: "Structured intake plus dynamic questioning." },
  {
    line: 3,
    requirement: "Incident Classification",
    position: "PARTIAL",
    notes:
      "Triage, nature mapping, session chips for duplicates/repeat/chronic. Live PremierOne nearby incidents and premise hazards currently return empty until vendor UAT — do not claim officer-safety-via-CAD as live.",
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
    notes:
      "Comprehend sentiment + lexical/Contact Lens distress. Distress may escalate to 911 and never suppresses keyword safety. Not a custom acoustic CNN; no silent continuous learning on production audio.",
  },
  {
    line: 6,
    requirement: "Language Support",
    position: "PARTIAL",
    notes:
      "English + Spanish heuristics; interpreter bridge is tenant config. TTY via Connect attributes + SMS fallback — not certified 911 TTY CPE.",
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
    notes:
      "Callback capture, after-hours/overflow offer, and Connect outbound campaign model. Outbound fails closed until Connect instance, flow, and caller ID are configured.",
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
    notes:
      "PremierOne + multi-CAD adapters with dual fail-closed write gates (CAD_WRITEBACK_ENABLED + ENABLE_CALL_ASSIST_CAD_PUSH). Create/update/disposition/unit status/attachments require Motorola PS + agency UAT. Nearby/hazards empty until live.",
  },
  { line: 12, requirement: "(Deleted in Addendum)", position: "N_A", notes: "RapidSOS line removed per Q&A; do not bid or demo." },
  {
    line: 13,
    requirement: "Telephony Integration",
    position: "PARTIAL",
    notes:
      "Amazon Connect webhook + contact-flow actions + ANI/ALI attributes. SIP/VoIP CPE, queue management, and overflow routing remain tenant telephony — not a NexCort iQ 911 phone-system replacement.",
  },
  {
    line: 14,
    requirement: "RMS Integration",
    position: "PARTIAL",
    notes: "RMSProvider interface + fail-closed drafts. Live Motorola Records filing is not Day-1 enabled.",
  },
  {
    line: 15,
    requirement: "GIS Integration",
    position: "PARTIAL",
    notes:
      "Caller-stated location plus optional geocode/zone enrichment from tenant config. Not a full agency GIS console; do not claim 95% location accuracy without measured UAT.",
  },
  {
    line: 16,
    requirement: "CJIS Requirements",
    position: "PARTIAL",
    notes:
      "CJIS-aligned MFA, encryption, RBAC, audit. Not FBI CJIS certification. Security Addendum, personnel screening, and annual pentest evidence are commercial/process deliverables.",
  },
  {
    line: 17,
    requirement: "Cybersecurity",
    position: "PARTIAL",
    notes:
      "WAF, Secrets Manager, tenant isolation, authenticated Connect webhook. ITSU engagement and any 24×7 SOC staffing are services/SOW — not implied by product alone.",
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
    position: "FULL",
    notes:
      "QA suite: transcript review, scoring, keyword search, false-transfer/escalation stats, supervisor tools. Call playback depends on ENABLE_CALL_ASSIST_RECORDING.",
  },
  {
    line: 20,
    requirement: "Analytics",
    position: "PARTIAL",
    notes:
      "Analytics suite includes AHT, containment, transfer, abandonment, language, heat-map hooks. Heat maps and peak-demand charts need live volume; empty in cold demo.",
  },
  {
    line: 21,
    requirement: "Administrative Features",
    position: "FULL",
    notes: "Config, routing, external agencies, knowledge, retention, records requests, prompt CMS.",
  },
  {
    line: 22,
    requirement: "Performance Metrics",
    position: "PARTIAL",
    notes:
      "Architecture on Lambda/Dynamo/Connect. Do not contract 99.99%, <2s AI, <500ms API, 95% ASR/location, or RPO 15m without Exhibit/SOW measurement evidence.",
  },
  { line: 23, requirement: "Training", position: "COMPLIANT", notes: "Deployment-team deliverable, not product code." },
  { line: 24, requirement: "Implementation", position: "COMPLIANT", notes: "PM/UAT/cutover is services, not product code." },
  { line: 25, requirement: "Maintenance", position: "COMPLIANT", notes: "Existing RC support model; name account manager in SOW." },
  {
    line: 26,
    requirement: "Vendor Qualifications",
    position: "PARTIAL",
    notes:
      "Demo via seeded scenario runner; multi-CAD portability via adapters. 5yr / US PSAP / >500k / 3 LE refs / proven AI PSAP deploys require real commercial references — do not bluff.",
  },
];
