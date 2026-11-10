import type { MonetizationPlanRecord } from "./entities.js";
import type { MonetizationAddOnId } from "./plan-ids.js";

/** Placeholder numeric fields — tune in Dynamo / NexCort Admin tooling; never shown on public marketing. */
export function defaultPlanSeed(now: string): Record<string, MonetizationPlanRecord> {
  const base = (
    partial: Pick<
      MonetizationPlanRecord,
      "planId" | "planName" | "publicName" | "description" | "billingType" | "supportLevel"
    >,
  ): MonetizationPlanRecord => ({
    ...partial,
    baseMonthlyPrice: null,
    baseAnnualPrice: null,
    setupFee: null,
    implementationFee: null,
    cadIntegrationFee: null,
    includedUsers: null,
    includedDispatchers: null,
    includedSupervisors: null,
    includedAdmins: null,
    includedResponders: null,
    includedApiCalls: null,
    includedIncidents: null,
    includedAiSummaries: null,
    includedTranscriptionMinutes: null,
    includedTranslationMinutes: null,
    includedMediaSessions: null,
    includedCadExports: null,
    includedWebhookDeliveries: null,
    overageApiCallRate: null,
    overageIncidentRate: null,
    overageAiSummaryRate: null,
    overageTranscriptionMinuteRate: null,
    overageTranslationMinuteRate: null,
    overageMediaSessionRate: null,
    overageCadExportRate: null,
    isPublic: false,
    requiresQuote: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    essential: {
      ...base({
        planId: "essential",
        planName: "rapid_essential_internal",
        publicName: "NexiQ Essential",
        description:
          "Entry dashboard platform — dispatcher, supervisor, admin, summaries, transcription, baseline reporting.",
        billingType: "pilot",
        supportLevel: "standard",
      }),
      productLine: "rapid_cortex_platform",
      planType: "dashboard",
      dashboardAccessEnabled: true,
      apiAccessEnabled: false,
      apiPortalEnabled: false,
    },
    command: {
      ...base({
        planId: "command",
        planName: "rapid_command_internal",
        publicName: "NexiQ Command",
        description:
          "Full operational platform — QA, executive, IT/security, translation, caller media, advanced reporting.",
        billingType: "monthly",
        supportLevel: "priority_optional",
      }),
      productLine: "rapid_cortex_platform",
      planType: "dashboard",
      dashboardAccessEnabled: true,
      apiAccessEnabled: false,
      apiPortalEnabled: false,
    },
    enterprise_statewide: {
      ...base({
        planId: "enterprise_statewide",
        planName: "rapid_enterprise_internal",
        publicName: "NexiQ Enterprise / Statewide",
        description:
          "Multi-agency, advanced integrations, evidence support, GovCloud-ready options, negotiated SLAs.",
        billingType: "custom",
        supportLevel: "dedicated_optional",
      }),
      productLine: "rapid_cortex_platform",
      planType: "enterprise",
      dashboardAccessEnabled: true,
      apiAccessEnabled: true,
      apiPortalEnabled: true,
    },
    rc_lite: {
      ...base({
        planId: "rc_lite",
        planName: "rapid_rc_lite_internal",
        publicName: "NexCort Lite",
        description:
          "Standalone API-only product sold separately from NexCort iQ dashboard plans (Essential / Command / Enterprise). Tenant-scoped REST/OAuth APIs for intelligence, media links, CAD export, metering, audit, and webhooks—no dispatcher, supervisor, or agency console entitlement.",
        billingType: "monthly",
        supportLevel: "standard",
      }),
      productLine: "rc_lite_api",
      planType: "api_only",
      dashboardAccessEnabled: false,
      apiAccessEnabled: true,
      apiPortalEnabled: true,
    },
  };
}

export function defaultAddOnSeed(now: string): Record<MonetizationAddOnId, import("./entities.js").MonetizationAddOnRecord> {
  const mk = (
    id: MonetizationAddOnId,
    addOnName: string,
    description: string,
  ): import("./entities.js").MonetizationAddOnRecord => ({
    addOnId: id,
    addOnName,
    description,
    baseMonthlyPrice: null,
    baseAnnualPrice: null,
    setupFee: null,
    includedUsage: null,
    overageRate: null,
    requiresQuote: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return {
    cad_integration: mk("cad_integration", "CAD Integration", "CAD-ready export, audit, health monitoring."),
    ai_call_intelligence: mk(
      "ai_call_intelligence",
      "AI / Call Intelligence",
      "Risk/priority cues, summaries, QA comparison.",
    ),
    transcription_translation: mk(
      "transcription_translation",
      "Transcription / Translation",
      "Live STT, translation, bilingual workflows.",
    ),
    caller_media: mk(
      "caller_media",
      "Caller Text / Photo / Video",
      "SMS sessions, uploads, retention controls.",
    ),
    supervisor_qa: mk("supervisor_qa", "Supervisor / QA", "Silent monitor, QA queue, coaching, trends."),
    api_access: mk("api_access", "API Access", "External REST API, sandbox, metering, docs."),
    premium_support: mk("premium_support", "Premium Support", "Priority routing, quarterly reviews."),
    onsite_deployment_training: mk(
      "onsite_deployment_training",
      "Onsite Deployment / Training",
      "Floor training and go-live support.",
    ),
    setup_implementation_fee: mk(
      "setup_implementation_fee",
      "Setup / Implementation Fee",
      "Initial integration, SSO, and workspace provisioning billed one-time.",
    ),
    call_assist: mk(
      "call_assist",
      "Nexiq (Non-Emergency)",
      "AI-assisted non-emergency intake, greetings, callbacks, and operator console.",
    ),
    pre_arrival: mk(
      "pre_arrival",
      "Pre-Arrival iQ",
      "CAD-triggered caller engagement via secure SMS — status, pre-arrival steps, messaging, media. $3,000/agency/year; 50k SMS included.",
    ),
    rapid_vision: mk(
      "rapid_vision",
      "iQ Vision™",
      "Scene intelligence over authorized cameras — observations and LIVE transcripts.",
    ),
    rc_translate: mk(
      "rc_translate",
      "NexCort Translate",
      "Field / venue / campus / clinical voice translation sessions.",
    ),
    cad_mesh: mk("cad_mesh", "CAD-to-CAD Mesh", "Cross-agency CAD mesh for mutual aid partners."),
    mutual_aid_mci: mk(
      "mutual_aid_mci",
      "Mutual Aid & MCI Command",
      "Mutual aid coordination and multi-casualty incident command.",
    ),
    ng911_assist: mk("ng911_assist", "NG911 Assist", "Diversion, EIDO, Additional Data, and NG911 metrics."),
    connect_nest_wyze: mk(
      "connect_nest_wyze",
      "Nest / Wyze Connect (legacy bundle)",
      "Legacy combined Nest+Wyze SKU — prefer connect_nest and connect_wyze.",
    ),
    connect_nest: mk("connect_nest", "Nest Connect", "Citizen/agency Google Nest SDM consent and live share."),
    connect_wyze: mk("connect_wyze", "Wyze Connect", "Citizen Wyze enroll, consent, and live share."),
    video_assist: mk(
      "video_assist",
      "Video Assist (SMS P2P)",
      "SMS → browser P2P WebRTC caller camera share.",
    ),
    live_video_kvs: mk(
      "live_video_kvs",
      "Live Video (KVS)",
      "Caller Mobile live video over Amazon KVS with optional export.",
    ),
    rc_video_wall: mk(
      "rc_video_wall",
      "NexCort iQ Video Wall",
      "SOC video wall layouts for facility camera registries.",
    ),
    rc_video_ptz_gateway: mk(
      "rc_video_ptz_gateway",
      "Video Gateway PTZ / DVR",
      "On-prem video gateway for PTZ control and DVR clips.",
    ),
    milestone_xprotect: mk(
      "milestone_xprotect",
      "Milestone XProtect Bridge",
      "On-prem Milestone bridge for camera sync and live tickets.",
    ),
  };
}
