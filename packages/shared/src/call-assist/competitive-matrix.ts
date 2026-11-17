/**
 * NEXiQ City Services — Competitive Matrix
 *
 * Market positioning data against primary 311 platform competitors.
 * Used by the sales/admin UI and onboarding wizard to highlight
 * differentiation points during demos and RFP responses.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Version: Phase 3 initial implementation.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CompetitiveFeatureStatus = "yes" | "no" | "partial" | "roadmap";

export type CompetitorProfile = {
  id: string;
  name: string;
  website: string;
  /** One-line market positioning. */
  pitch: string;
  /** Key features and their status for this competitor. */
  features: Record<CompetitiveFeatureKey, CompetitiveFeatureStatus>;
  /** Weak points from customer research. */
  weaknesses: string[];
  /** Win conditions when competing against this vendor. */
  winConditions: string[];
};

export type CompetitiveFeatureKey = keyof typeof COMPETITIVE_FEATURE_LABELS;

// ---------------------------------------------------------------------------
// Feature label registry
// ---------------------------------------------------------------------------

export const COMPETITIVE_FEATURE_LABELS = {
  ai_voice_intake: "AI-Powered Voice Intake (Nova / Lex)",
  realtime_transcription: "Real-Time Call Transcription",
  multilingual: "Multi-Language Support",
  open311_outbound: "Open311 GeoReport v2 Outbound",
  open311_inbound: "Open311 Inbound Webhook",
  status_sms: "Proactive Status SMS to Citizen",
  media_upload: "Citizen Photo / Media Upload",
  duplicate_detection: "Automatic Duplicate Detection",
  cad_integration: "CAD Integration",
  department_playbooks: "Structured Department Playbooks",
  unified_inbox: "Unified Multi-Channel Inbox",
  analytics_dashboard: "Real-Time Analytics Dashboard",
  confirmation_callback: "Confirmation Callback Loop",
  staff_portal: "Staff Portal for Manual Entry",
  mobile_app: "Resident Mobile App",
  offline_reporting: "Offline / Kiosk Reporting",
  api_public: "Public REST API",
  sla_enforcement: "Automated SLA Enforcement",
  escalation_workflow: "Tiered Escalation Workflow",
  qr_nfc_intake: "QR / NFC On-Site Intake",
} as const;

// ---------------------------------------------------------------------------
// Competitor profiles
// ---------------------------------------------------------------------------

export const COMPETITOR_PROFILES: CompetitorProfile[] = [
  {
    id: "seeclickfix",
    name: "SeeClickFix (Oracle)",
    website: "https://seeclickfix.com",
    pitch: "Citizen issue-reporting via map-based web and mobile app.",
    features: {
      ai_voice_intake: "no",
      realtime_transcription: "no",
      multilingual: "partial",
      open311_outbound: "yes",
      open311_inbound: "yes",
      status_sms: "partial",
      media_upload: "yes",
      duplicate_detection: "partial",
      cad_integration: "no",
      department_playbooks: "no",
      unified_inbox: "partial",
      analytics_dashboard: "partial",
      confirmation_callback: "partial",
      staff_portal: "yes",
      mobile_app: "yes",
      offline_reporting: "no",
      api_public: "yes",
      sla_enforcement: "partial",
      escalation_workflow: "partial",
      qr_nfc_intake: "no",
    },
    weaknesses: [
      "No voice/AI intake — requires citizen to open app or web form",
      "Oracle acquisition created pricing/roadmap uncertainty",
      "No CAD integration",
      "Limited multi-language voice support",
    ],
    winConditions: [
      "Agency wants AI voice intake and auto-transcription",
      "Agency has an active 911/CAD integration requirement",
      "Agency serves a large non-English-speaking population",
      "Agency wants a single platform across PSAP and 311",
    ],
  },
  {
    id: "salesforce_311",
    name: "Salesforce Government Cloud (311 add-on)",
    website: "https://www.salesforce.com/solutions/government/",
    pitch: "CRM-based 311 built on the Salesforce platform.",
    features: {
      ai_voice_intake: "partial",
      realtime_transcription: "partial",
      multilingual: "partial",
      open311_outbound: "partial",
      open311_inbound: "partial",
      status_sms: "yes",
      media_upload: "yes",
      duplicate_detection: "partial",
      cad_integration: "partial",
      department_playbooks: "yes",
      unified_inbox: "yes",
      analytics_dashboard: "yes",
      confirmation_callback: "yes",
      staff_portal: "yes",
      mobile_app: "yes",
      offline_reporting: "partial",
      api_public: "yes",
      sla_enforcement: "yes",
      escalation_workflow: "yes",
      qr_nfc_intake: "no",
    },
    weaknesses: [
      "Very high cost — per-seat licensing plus implementation",
      "Long implementation timelines (6–18 months)",
      "Voice intake requires Salesforce Voice add-on (extra cost)",
      "No native emergency/PSAP integration",
      "Overkill for smaller municipalities",
    ],
    winConditions: [
      "Agency wants a single-vendor platform under $X/year",
      "Agency needs to go live within 90 days",
      "Agency wants PSAP + 311 in one platform",
      "Agency is evaluating cost per SR rather than per-seat licensing",
    ],
  },
  {
    id: "citibot",
    name: "Citibot",
    website: "https://citibot.io",
    pitch: "Chatbot-first 311 intake via SMS and web chat.",
    features: {
      ai_voice_intake: "no",
      realtime_transcription: "no",
      multilingual: "partial",
      open311_outbound: "yes",
      open311_inbound: "partial",
      status_sms: "yes",
      media_upload: "partial",
      duplicate_detection: "no",
      cad_integration: "no",
      department_playbooks: "partial",
      unified_inbox: "partial",
      analytics_dashboard: "partial",
      confirmation_callback: "partial",
      staff_portal: "partial",
      mobile_app: "no",
      offline_reporting: "no",
      api_public: "partial",
      sla_enforcement: "no",
      escalation_workflow: "no",
      qr_nfc_intake: "no",
    },
    weaknesses: [
      "SMS/chat only — no voice/Nova intake",
      "No CAD integration",
      "No escalation workflow",
      "No SLA enforcement",
      "Limited analytics",
    ],
    winConditions: [
      "Agency calls volume is higher than SMS/chat volume",
      "Agency wants escalation workflows to supervisors",
      "Agency has an active CAD or PSAP integration",
    ],
  },
  {
    id: "lagan_oracle",
    name: "Lagan (Oracle / Verint)",
    website: "https://www.oracle.com/industries/public-sector/",
    pitch: "Legacy enterprise 311 CRM used by major North American cities.",
    features: {
      ai_voice_intake: "no",
      realtime_transcription: "no",
      multilingual: "partial",
      open311_outbound: "yes",
      open311_inbound: "yes",
      status_sms: "partial",
      media_upload: "yes",
      duplicate_detection: "partial",
      cad_integration: "partial",
      department_playbooks: "yes",
      unified_inbox: "yes",
      analytics_dashboard: "yes",
      confirmation_callback: "partial",
      staff_portal: "yes",
      mobile_app: "partial",
      offline_reporting: "no",
      api_public: "partial",
      sla_enforcement: "yes",
      escalation_workflow: "yes",
      qr_nfc_intake: "no",
    },
    weaknesses: [
      "Legacy on-premise architecture — cloud migration is disruptive",
      "No AI/voice intake",
      "High maintenance and professional services cost",
      "Slow innovation cycle",
      "Difficult API integration with modern systems",
    ],
    winConditions: [
      "Agency is on Lagan and looking to modernize",
      "Agency wants cloud-native architecture",
      "Agency wants AI intake and auto-transcription",
      "Agency has a mandate to reduce implementation cost",
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROFILE_MAP = new Map(COMPETITOR_PROFILES.map((c) => [c.id, c]));

export function getCompetitorProfile(id: string): CompetitorProfile | undefined {
  return PROFILE_MAP.get(id);
}

/** NexCort iQ feature parity map — our own status for each feature key. */
export const NEXCORTIQ_FEATURES: Record<CompetitiveFeatureKey, CompetitiveFeatureStatus> = {
  ai_voice_intake: "yes",
  realtime_transcription: "yes",
  multilingual: "yes",
  open311_outbound: "yes",
  open311_inbound: "yes",
  status_sms: "yes",
  media_upload: "yes",
  duplicate_detection: "yes",
  cad_integration: "yes",
  department_playbooks: "yes",
  unified_inbox: "yes",
  analytics_dashboard: "yes",
  confirmation_callback: "yes",
  staff_portal: "yes",
  mobile_app: "roadmap",
  offline_reporting: "roadmap",
  api_public: "yes",
  sla_enforcement: "yes",
  escalation_workflow: "yes",
  qr_nfc_intake: "yes",
};

/**
 * Returns feature keys where NexCort iQ is "yes" and the competitor is "no" or "partial".
 * Used to generate battle-card differentiators.
 */
export function differentiatorKeys(competitorId: string): CompetitiveFeatureKey[] {
  const profile = PROFILE_MAP.get(competitorId);
  if (!profile) return [];
  return (Object.keys(COMPETITIVE_FEATURE_LABELS) as CompetitiveFeatureKey[]).filter((k) => {
    const nexcortiq = NEXCORTIQ_FEATURES[k];
    const theirs = profile.features[k];
    return nexcortiq === "yes" && (theirs === "no" || theirs === "partial");
  });
}
