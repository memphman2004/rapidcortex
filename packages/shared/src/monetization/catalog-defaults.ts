import type { MonetizationPlanRecord } from "./entities.js";
import type { MonetizationAddOnId } from "./plan-ids.js";

/** Placeholder numeric fields — tune in Dynamo / RC Admin tooling; never shown on public marketing. */
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
        publicName: "Rapid Cortex Essential",
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
        publicName: "Rapid Cortex Command",
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
        publicName: "Rapid Cortex Enterprise / Statewide",
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
        publicName: "RC Lite",
        description:
          "Standalone API-only product sold separately from Rapid Cortex dashboard plans (Essential / Command / Enterprise). Tenant-scoped REST/OAuth APIs for intelligence, media links, CAD export, metering, audit, and webhooks—no dispatcher, supervisor, or agency console entitlement.",
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
  };
}
