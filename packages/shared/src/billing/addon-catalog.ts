import { type AddonDefinition, type AddonKey, type CommercialPlanLabel } from "./addon-types.js";

type CatalogSeed = Omit<AddonDefinition, "includedInPlans">;

function withLegacyIncludedInPlans(def: CatalogSeed): AddonDefinition {
  return { ...def, includedInPlans: def.planAvailability };
}

const professionalPlus: CommercialPlanLabel[] = ["professional", "command", "enterprise"];
const commandPlus: CommercialPlanLabel[] = ["command", "enterprise"];
const enterpriseOnly: CommercialPlanLabel[] = ["enterprise"];
const allPlans: CommercialPlanLabel[] = ["essential", "professional", "command", "enterprise"];

export const ADDON_CATALOG: AddonDefinition[] = [
  // CAD Integration
  withLegacyIncludedInPlans({
    key: "cad.discovery",
    name: "CAD Discovery Workshop",
    category: "CAD Integration",
    description:
      "Scoped workshop to map CAD vendor, API availability, field mapping, and integration path.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 10000,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.vendor_coordination",
    name: "CAD Vendor Coordination",
    category: "CAD Integration",
    description:
      "Rapid Cortex-led coordination with agency CAD vendor for API access and sandbox setup.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 17500,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.readonly",
    name: "CAD Read-Only Integration",
    category: "CAD Integration",
    description:
      "One-way read integration from agency CAD into Rapid Cortex context panel. No write-back.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 67500,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.writeback_assisted",
    name: "CAD Assisted Write-Back",
    category: "CAD Integration",
    description:
      "One-click transfer to CAD with dispatcher review and approval before submit.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 162500,
    planAvailability: commandPlus,
    featureFlag: "cad_writeback",
  }),
  withLegacyIncludedInPlans({
    key: "cad.writeback_automated",
    name: "CAD Automated Write-Back",
    category: "CAD Integration",
    description:
      "Full bidirectional sync between Rapid Cortex and CAD with automated field mapping.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 325000,
    planAvailability: enterpriseOnly,
    featureFlag: "cad_writeback",
  }),
  withLegacyIncludedInPlans({
    key: "cad.sandbox_testing",
    name: "CAD Sandbox Testing Package",
    category: "CAD Integration",
    description:
      "Isolated test environment with CAD vendor for integration validation before go-live.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 32500,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.field_mapping",
    name: "CAD Field Mapping Document",
    category: "CAD Integration",
    description:
      "Formal field mapping specification between Rapid Cortex and agency CAD data model.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 13750,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.audit_logging",
    name: "CAD Integration Audit Logging",
    category: "CAD Integration",
    description:
      "Enhanced audit trail for all CAD read/write events, approvals, and rejections.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 22500,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.rollback_planning",
    name: "CAD Rollback & Failover Planning",
    category: "CAD Integration",
    description:
      "Documented rollback procedures and failover testing for CAD integration resilience.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 20000,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "cad.additional_connector",
    name: "Additional CAD Vendor Connector",
    category: "CAD Integration",
    description:
      "Custom connector for a second or additional CAD vendor not included in base integration.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 187500,
    planAvailability: enterpriseOnly,
  }),

  // AI / Call Intelligence
  withLegacyIncludedInPlans({
    key: "ai.triage.basic",
    name: "Advanced AI Triage - Basic",
    category: "AI / Call Intelligence",
    description: "5-10 custom triage rules across core emergency types.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.triage.standard",
    name: "Advanced AI Triage - Standard",
    category: "AI / Call Intelligence",
    description:
      "10-25 rules across 3-5 emergency types with enhanced confidence scoring.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.triage.premium",
    name: "Advanced AI Triage - Premium",
    category: "AI / Call Intelligence",
    description:
      "25+ rules across all emergency types with full dispatcher recommendation engine.",
    billingType: "monthly",
    monthlyPrice: 7500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.model_redundancy.secondary",
    name: "Secondary AI Model Review",
    category: "AI / Call Intelligence",
    description:
      "Second AI model validates primary triage output for higher-confidence decisions.",
    billingType: "monthly",
    monthlyPrice: 4000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.model_redundancy.tertiary",
    name: "Tertiary AI Model Fallback",
    category: "AI / Call Intelligence",
    description:
      "Third-model fallback path for when primary and secondary models diverge.",
    billingType: "monthly",
    monthlyPrice: 4000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "ai.confidence.basic",
    name: "AI Confidence Scoring - Basic",
    category: "AI / Call Intelligence",
    description:
      "Single-factor confidence score displayed on AI triage output.",
    billingType: "monthly",
    monthlyPrice: 1500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.confidence.premium",
    name: "AI Confidence Scoring - Premium",
    category: "AI / Call Intelligence",
    description:
      "Multi-factor weighted confidence scoring with explainability panel.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.summarization.basic",
    name: "AI Incident Summarization - Basic",
    category: "AI / Call Intelligence",
    description: "AI-generated incident summaries for calls under 5K/month.",
    billingType: "monthly",
    monthlyPrice: 1500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.summarization.standard",
    name: "AI Incident Summarization - Standard",
    category: "AI / Call Intelligence",
    description: "AI-generated incident summaries for 5K-20K calls/month.",
    billingType: "monthly",
    monthlyPrice: 3500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.summarization.premium",
    name: "AI Incident Summarization - Premium",
    category: "AI / Call Intelligence",
    description: "AI-generated incident summaries for 20K+ calls/month.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "ai.custom_prompts",
    name: "Custom Agency AI Prompts & Playbooks",
    category: "AI / Call Intelligence",
    description:
      "Agency-specific custom prompts, playbooks, and emergency-type workflow tuning.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 30000,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.pir_package",
    name: "AI Post-Incident Review Package",
    category: "AI / Call Intelligence",
    description:
      "AI-assisted post-incident review with trend surfacing and supervisor summary.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "ai.qa_scoring",
    name: "AI QA Scoring Model",
    category: "AI / Call Intelligence",
    description:
      "AI-assisted quality scoring applied to dispatcher call reviews and QA workflows.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),

  // Transcription & Translation
  withLegacyIncludedInPlans({
    key: "transcription.enhanced.tier1",
    name: "Enhanced Transcription - Tier 1",
    category: "Transcription & Translation",
    description: "Enhanced accuracy transcription for under 5K calls/month.",
    billingType: "monthly",
    monthlyPrice: 1500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "transcription.enhanced.tier2",
    name: "Enhanced Transcription - Tier 2",
    category: "Transcription & Translation",
    description: "Enhanced accuracy transcription for 5K-15K calls/month.",
    billingType: "monthly",
    monthlyPrice: 3000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "transcription.enhanced.tier3",
    name: "Enhanced Transcription - Tier 3",
    category: "Transcription & Translation",
    description: "Enhanced accuracy transcription for 15K+ calls/month.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "transcription.diarization.tier1",
    name: "Speaker Separation (Diarization) - Tier 1",
    category: "Transcription & Translation",
    description: "Identify and label individual speakers for under 5K calls/month.",
    billingType: "monthly",
    monthlyPrice: 1000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "transcription.diarization.tier2",
    name: "Speaker Separation (Diarization) - Tier 2",
    category: "Transcription & Translation",
    description: "Speaker separation for 5K-15K calls/month.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "transcription.diarization.tier3",
    name: "Speaker Separation (Diarization) - Tier 3",
    category: "Transcription & Translation",
    description: "Speaker separation for 15K+ calls/month.",
    billingType: "monthly",
    monthlyPrice: 4000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "translation.live.tier1",
    name: "Live Translation - Tier 1",
    category: "Transcription & Translation",
    description:
      "Live translation for 2-3 languages, under 2K translations/month.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "translation.live.tier2",
    name: "Live Translation - Tier 2",
    category: "Transcription & Translation",
    description: "Live translation for 4-6 languages, 2K-5K translations/month.",
    billingType: "monthly",
    monthlyPrice: 5500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "translation.live.tier3",
    name: "Live Translation - Tier 3",
    category: "Transcription & Translation",
    description:
      "Live translation for 7-10 languages, 5K-10K translations/month.",
    billingType: "monthly",
    monthlyPrice: 8000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "translation.live.tier4",
    name: "Live Translation - Tier 4",
    category: "Transcription & Translation",
    description:
      "Live translation for 10+ languages, 10K+ translations/month.",
    billingType: "monthly",
    monthlyPrice: 10000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "translation.text_to_voice",
    name: "Text-to-Voice Support",
    category: "Transcription & Translation",
    description:
      "Convert translated text back to voice for caller confirmation and dispatcher playback.",
    billingType: "monthly",
    monthlyPrice: 3250,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "translation.custom_language",
    name: "Custom Language Package",
    category: "Transcription & Translation",
    description:
      "Support for rare, regional, or custom languages beyond the standard 40+ language set.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "translation.audit_trail",
    name: "Translation Audit Trail",
    category: "Transcription & Translation",
    description:
      "Immutable log of all translation events with source text, output, confidence, and timestamp.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),

  // Caller Media
  withLegacyIncludedInPlans({
    key: "caller_media.sms_link",
    name: "Caller SMS Link Generation",
    category: "Caller Media",
    description:
      "Send callers a secure, expiring SMS link to submit photos or start media sessions.",
    billingType: "monthly",
    monthlyPrice: 3250,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.text_conversation",
    name: "Text-Only Emergency Conversation",
    category: "Caller Media",
    description:
      "Secure text chat channel for callers who cannot speak safely. 300-1K conversations/month.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.photo.basic",
    name: "Caller Photo Upload - Basic",
    category: "Caller Media",
    description: "Under 500 photos/month, 5MB max, 30-day retention.",
    billingType: "monthly",
    monthlyPrice: 1000,
    oneTimePrice: 0,
    planAvailability: allPlans,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.photo.standard",
    name: "Caller Photo Upload - Standard",
    category: "Caller Media",
    description: "500-2K photos/month, 10MB max, 90-day retention.",
    billingType: "monthly",
    monthlyPrice: 2000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.photo.premium",
    name: "Caller Photo Upload - Premium",
    category: "Caller Media",
    description: "2K+ photos/month, 25MB max, 1-year retention.",
    billingType: "monthly",
    monthlyPrice: 3500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.video.basic",
    name: "Caller Video Upload - Basic",
    category: "Caller Media",
    description: "Under 200 videos/month, 50MB max, 30-day retention.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.video.standard",
    name: "Caller Video Upload - Standard",
    category: "Caller Media",
    description: "200-750 videos/month, 100MB max, 90-day retention.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.video.premium",
    name: "Caller Video Upload - Premium",
    category: "Caller Media",
    description: "750+ videos/month, 250MB max, 1-year retention.",
    billingType: "monthly",
    monthlyPrice: 8500,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.live_stream.basic",
    name: "Live Caller Video Streaming - Basic",
    category: "Caller Media",
    description:
      "Up to 100 concurrent streams at 720p via Kinesis Video Streams.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
    featureFlag: "live_video",
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.live_stream.standard",
    name: "Live Caller Video Streaming - Standard",
    category: "Caller Media",
    description: "100-300 concurrent streams at 1080p.",
    billingType: "monthly",
    monthlyPrice: 10000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
    featureFlag: "live_video",
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.live_stream.premium",
    name: "Live Caller Video Streaming - Premium",
    category: "Caller Media",
    description: "300-500 concurrent streams at 1080p.",
    billingType: "monthly",
    monthlyPrice: 15000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
    featureFlag: "live_video",
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.live_stream.enterprise",
    name: "Live Caller Video Streaming - Enterprise",
    category: "Caller Media",
    description:
      "500+ concurrent streams with 4K option and dedicated KVS channel allocation.",
    billingType: "monthly",
    monthlyPrice: 20000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
    featureFlag: "live_video",
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.media_audit_trail",
    name: "Media Audit Trail",
    category: "Caller Media",
    description:
      "Append-only log of all media access, download, and expiration events.",
    billingType: "monthly",
    monthlyPrice: 3250,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.evidence_retention",
    name: "Evidence Retention Controls",
    category: "Caller Media",
    description:
      "Extended configurable retention policies for evidentiary media with legal hold support.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "caller_media.redaction",
    name: "Media Redaction Workflow",
    category: "Caller Media",
    description:
      "Dispatcher and supervisor tools to redact faces, plates, and PII from stored media before export.",
    billingType: "monthly",
    monthlyPrice: 12500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),

  // Supervisor / QA
  withLegacyIncludedInPlans({
    key: "supervisor_qa.review_tools.basic",
    name: "QA Review Tools - Basic",
    category: "Supervisor / QA",
    description: "Up to 10 reviewers, under 1K reviews/month.",
    billingType: "monthly",
    monthlyPrice: 1500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.review_tools.standard",
    name: "QA Review Tools - Standard",
    category: "Supervisor / QA",
    description: "10-25 reviewers, 1K-3K reviews/month.",
    billingType: "monthly",
    monthlyPrice: 3000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.review_tools.premium",
    name: "QA Review Tools - Premium",
    category: "Supervisor / QA",
    description:
      "25+ reviewers, 3K+ reviews/month with custom rubric support.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.scorecards.basic",
    name: "Dispatcher Scorecards - Basic",
    category: "Supervisor / QA",
    description: "Weekly scorecards for up to 25 dispatchers.",
    billingType: "monthly",
    monthlyPrice: 1000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.scorecards.standard",
    name: "Dispatcher Scorecards - Standard",
    category: "Supervisor / QA",
    description: "Daily scorecards for 25-75 dispatchers.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.scorecards.premium",
    name: "Dispatcher Scorecards - Premium",
    category: "Supervisor / QA",
    description:
      "Real-time scorecards for 75+ dispatchers with trend analysis.",
    billingType: "monthly",
    monthlyPrice: 4000,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.coaching_notes",
    name: "Coaching Notes",
    category: "Supervisor / QA",
    description:
      "Structured supervisor coaching notes linked to call records and dispatcher profiles.",
    billingType: "monthly",
    monthlyPrice: 2500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.team_dashboards.basic",
    name: "Team Performance Dashboards - Basic",
    category: "Supervisor / QA",
    description: "1-3 dashboards for under 25 dispatchers.",
    billingType: "monthly",
    monthlyPrice: 2000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.team_dashboards.standard",
    name: "Team Performance Dashboards - Standard",
    category: "Supervisor / QA",
    description: "3-8 dashboards for 25-75 dispatchers.",
    billingType: "monthly",
    monthlyPrice: 4500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.team_dashboards.premium",
    name: "Team Performance Dashboards - Premium",
    category: "Supervisor / QA",
    description:
      "8+ dashboards for 75+ dispatchers with export and scheduling.",
    billingType: "monthly",
    monthlyPrice: 7500,
    oneTimePrice: 0,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.call_quality_trends",
    name: "Call Quality Trends",
    category: "Supervisor / QA",
    description:
      "Longitudinal call quality trend charts with anomaly flagging and drill-down.",
    billingType: "monthly",
    monthlyPrice: 4750,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.custom_rubric",
    name: "Custom QA Scoring Rubric",
    category: "Supervisor / QA",
    description:
      "Bespoke QA rubric built to agency protocols with weighted scoring dimensions.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 16250,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "supervisor_qa.monthly_analytics_report",
    name: "Monthly QA Analytics Report",
    category: "Supervisor / QA",
    description:
      "Automated monthly QA summary delivered to supervisors and agency admins.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),

  // Incident Command
  withLegacyIncludedInPlans({
    key: "incident_command.major_incident",
    name: "Major Incident Management",
    category: "Incident Command",
    description:
      "Structured major incident workflows with role assignments, status boards, and escalation paths.",
    billingType: "monthly",
    monthlyPrice: 12500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.command_dashboard",
    name: "Command Dashboard",
    category: "Incident Command",
    description:
      "Real-time command situational awareness dashboard for supervisors and command staff.",
    billingType: "monthly",
    monthlyPrice: 12500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.war_rooms",
    name: "War Rooms",
    category: "Incident Command",
    description:
      "Collaborative virtual incident rooms with shared timeline, notes, and attendee management.",
    billingType: "monthly",
    monthlyPrice: 9250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.runbooks",
    name: "Runbooks / Playbooks",
    category: "Incident Command",
    description:
      "Agency-configured runbooks and playbooks surfaced during active incidents.",
    billingType: "monthly",
    monthlyPrice: 7500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.timeline",
    name: "Incident Timeline Reconstruction",
    category: "Incident Command",
    description:
      "Full chronological incident timeline with all events, media, and decisions.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.pir",
    name: "Post-Incident Reviews",
    category: "Incident Command",
    description:
      "Structured post-incident review workflow with findings, action items, and sign-off.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.stakeholder_status",
    name: "Stakeholder Status Pages",
    category: "Incident Command",
    description:
      "Configurable status pages for real-time incident updates to internal stakeholders and PIO.",
    billingType: "monthly",
    monthlyPrice: 9250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "incident_command.executive_briefing",
    name: "Executive Incident Briefing Module",
    category: "Incident Command",
    description:
      "Auto-generated executive briefing packages with summary, timeline, and action items.",
    billingType: "monthly",
    monthlyPrice: 9250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),

  // Reliability / Technical Ops
  withLegacyIncludedInPlans({
    key: "reliability.monitoring_integrations",
    name: "Monitoring Integrations",
    category: "Reliability / Technical Ops",
    description:
      "Connect Rapid Cortex operational health to PagerDuty, OpsGenie, Datadog, or custom endpoints.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.alert_correlation",
    name: "Alert Correlation",
    category: "Reliability / Technical Ops",
    description:
      "Correlate platform alerts to reduce noise and surface root-cause signals.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.escalation_engine",
    name: "Escalation Engine",
    category: "Reliability / Technical Ops",
    description:
      "Configurable escalation rules with time-based promotion and on-call routing.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.on_call_routing",
    name: "On-Call Routing",
    category: "Reliability / Technical Ops",
    description:
      "Structured on-call schedules and routing integrated with escalation engine.",
    billingType: "monthly",
    monthlyPrice: 6250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.slo_dashboards",
    name: "SLO Dashboards",
    category: "Reliability / Technical Ops",
    description:
      "Agency-facing SLO tracking dashboards with error budget burn rate visualization.",
    billingType: "monthly",
    monthlyPrice: 4750,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.reliability_reporting",
    name: "Reliability Reporting",
    category: "Reliability / Technical Ops",
    description:
      "Monthly reliability reports with uptime, incident count, and MTTR.",
    billingType: "monthly",
    monthlyPrice: 4750,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.cloudwatch_package",
    name: "CloudWatch Dashboard Package",
    category: "Reliability / Technical Ops",
    description:
      "Pre-built CloudWatch dashboards scoped to agency tenant metrics and alarms.",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 12500,
    planAvailability: commandPlus,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.custom_monitoring_connector",
    name: "Agency-Specific Monitoring Connector",
    category: "Reliability / Technical Ops",
    description:
      "Custom connector to agency's existing monitoring stack (SIEM, NOC, etc.).",
    billingType: "one_time",
    monthlyPrice: 0,
    oneTimePrice: 30000,
    planAvailability: enterpriseOnly,
  }),
  withLegacyIncludedInPlans({
    key: "reliability.support_upgrade_247",
    name: "24/7 Incident Support Upgrade",
    category: "Reliability / Technical Ops",
    description:
      "Upgrade to 24/7 incident response SLA with dedicated on-call RC engineer.",
    billingType: "monthly",
    monthlyPrice: 16250,
    oneTimePrice: 0,
    planAvailability: commandPlus,
  }),

  // Hospital / MCI
  withLegacyIncludedInPlans({
    key: "hospital.routing",
    name: "Hospital Routing Module",
    category: "Hospital / MCI",
    description:
      "Hospital divert status, ED routing, trauma bay availability, and staff safety portal.",
    billingType: "monthly",
    monthlyPrice: 5000,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
    verticalRequired: "hospital",
    featureFlag: "hospital_routing",
  }),
  withLegacyIncludedInPlans({
    key: "hospital.mci_routing",
    name: "MCI Routing & Coordination",
    category: "Hospital / MCI",
    description:
      "Mass casualty incident routing, triage coordination, and multi-agency patient tracking.",
    billingType: "monthly",
    monthlyPrice: 8500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
    verticalRequired: "hospital",
    featureFlag: "mci_routing",
  }),
  withLegacyIncludedInPlans({
    key: "hospital.staff_safety",
    name: "Staff Safety Call Tracking",
    category: "Hospital / MCI",
    description:
      "Dedicated staff duress and safety call tracking with escalation and response logging.",
    billingType: "monthly",
    monthlyPrice: 3500,
    oneTimePrice: 0,
    planAvailability: professionalPlus,
    verticalRequired: "hospital",
  }),
  withLegacyIncludedInPlans({
    key: "hospital.patient_tracking",
    name: "Patient Tracking Integration",
    category: "Hospital / MCI",
    description:
      "Real-time patient location and status tracking integrated with hospital systems.",
    billingType: "monthly",
    monthlyPrice: 6500,
    oneTimePrice: 0,
    planAvailability: commandPlus,
    verticalRequired: "hospital",
  }),
];

export function getAddonByKey(key: AddonKey): AddonDefinition {
  const found = ADDON_CATALOG.find((a) => a.key === key);
  if (!found) throw new Error(`Unknown addon key: ${key}`);
  return found;
}

export function isAddonIncludedInPlan(def: AddonDefinition, planLabel: string): boolean {
  const normalized = normalizePlanLabel(planLabel);
  if (!normalized) return false;
  return def.planAvailability.includes(normalized);
}

export function normalizePlanLabel(plan: string): CommercialPlanLabel | null {
  const p = plan.trim().toLowerCase();
  if (p === "essential" || p === "starter" || p.includes("essential") || p.includes("starter")) {
    return "essential";
  }
  if (p === "command" || p.includes("command")) return "command";
  if (p === "enterprise" || p.includes("enterprise") || p.includes("statewide")) return "enterprise";
  if (p === "professional" || p.includes("professional")) return "professional";
  return null;
}

export function addonCatalogPriceCents(def: AddonDefinition): number {
  if (def.billingType === "one_time") return Math.round(def.oneTimePrice * 100);
  return Math.round(def.monthlyPrice * 100);
}
