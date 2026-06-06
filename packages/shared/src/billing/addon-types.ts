import { z } from "zod";

export const ADDON_KEYS = [
  "cad.discovery",
  "cad.vendor_coordination",
  "cad.readonly",
  "cad.writeback_assisted",
  "cad.writeback_automated",
  "cad.sandbox_testing",
  "cad.field_mapping",
  "cad.audit_logging",
  "cad.rollback_planning",
  "cad.additional_connector",
  "ai.triage.basic",
  "ai.triage.standard",
  "ai.triage.premium",
  "ai.model_redundancy.secondary",
  "ai.model_redundancy.tertiary",
  "ai.confidence.basic",
  "ai.confidence.premium",
  "ai.summarization.basic",
  "ai.summarization.standard",
  "ai.summarization.premium",
  "ai.custom_prompts",
  "ai.pir_package",
  "ai.qa_scoring",
  "transcription.enhanced.tier1",
  "transcription.enhanced.tier2",
  "transcription.enhanced.tier3",
  "transcription.diarization.tier1",
  "transcription.diarization.tier2",
  "transcription.diarization.tier3",
  "translation.live.tier1",
  "translation.live.tier2",
  "translation.live.tier3",
  "translation.live.tier4",
  "translation.text_to_voice",
  "translation.custom_language",
  "translation.audit_trail",
  "caller_media.sms_link",
  "caller_media.text_conversation",
  "caller_media.photo.basic",
  "caller_media.photo.standard",
  "caller_media.photo.premium",
  "caller_media.video.basic",
  "caller_media.video.standard",
  "caller_media.video.premium",
  "caller_media.live_stream.basic",
  "caller_media.live_stream.standard",
  "caller_media.live_stream.premium",
  "caller_media.live_stream.enterprise",
  "caller_media.media_audit_trail",
  "caller_media.evidence_retention",
  "caller_media.redaction",
  "supervisor_qa.review_tools.basic",
  "supervisor_qa.review_tools.standard",
  "supervisor_qa.review_tools.premium",
  "supervisor_qa.scorecards.basic",
  "supervisor_qa.scorecards.standard",
  "supervisor_qa.scorecards.premium",
  "supervisor_qa.coaching_notes",
  "supervisor_qa.team_dashboards.basic",
  "supervisor_qa.team_dashboards.standard",
  "supervisor_qa.team_dashboards.premium",
  "supervisor_qa.call_quality_trends",
  "supervisor_qa.custom_rubric",
  "supervisor_qa.monthly_analytics_report",
  "incident_command.major_incident",
  "incident_command.command_dashboard",
  "incident_command.war_rooms",
  "incident_command.runbooks",
  "incident_command.timeline",
  "incident_command.pir",
  "incident_command.stakeholder_status",
  "incident_command.executive_briefing",
  "reliability.monitoring_integrations",
  "reliability.alert_correlation",
  "reliability.escalation_engine",
  "reliability.on_call_routing",
  "reliability.slo_dashboards",
  "reliability.reliability_reporting",
  "reliability.cloudwatch_package",
  "reliability.custom_monitoring_connector",
  "reliability.support_upgrade_247",
  "hospital.routing",
  "hospital.mci_routing",
  "hospital.staff_safety",
  "hospital.patient_tracking",
] as const;

export type AddonKey = (typeof ADDON_KEYS)[number];

export type BillingType = "monthly" | "one_time";
export type CommercialPlanLabel =
  | "essential"
  | "professional"
  | "command"
  | "enterprise";

export interface AddonDefinition {
  key: AddonKey;
  name: string;
  category: string;
  billingType: BillingType;
  /** Display / catalog monthly price in USD major units (0 if one_time). */
  monthlyPrice: number;
  /** Display / catalog one-time price in USD major units (0 if monthly). */
  oneTimePrice: number;
  /** Canonical plan inclusion list (lowercase). */
  planAvailability: CommercialPlanLabel[];
  /**
   * Legacy alias still read by older UI code paths.
   * New logic should use `planAvailability`.
   */
  includedInPlans?: CommercialPlanLabel[];
  /** Optional feature flag gate (e.g. cad_writeback, live_video). */
  featureFlag?: string;
  /** Optional required tenant vertical (e.g. hospital). */
  verticalRequired?: "core" | "campus" | "venue" | "hospital";
  description: string;
}

export interface TenantAddonState {
  key: AddonKey;
  enabled: boolean;
  enabledAt?: string;
  enabledBy?: string;
  disabledAt?: string;
  disabledBy?: string;
  scheduledDisableAt?: string;
  overridePriceCents?: number;
  notes?: string;
}

export interface TenantEntitlements {
  tenantId: string;
  plan: string;
  addons: Record<AddonKey, TenantAddonState>;
  lastModifiedAt: string;
  lastModifiedBy: string;
  schemaVersion: number;
}

export type AddonChangeAction =
  | "enabled"
  | "disabled"
  | "tier_changed"
  | "price_overridden"
  | "scheduled_disable";

export interface InvoiceLineItemDelta {
  lineItemId: string;
  description: string;
  previousMonthlyAmountCents: number;
  newMonthlyAmountCents: number;
  deltaMonthlyAmountCents: number;
  proRataAdjustmentCents: number;
  billingType: BillingType;
  effectiveDate: string;
}

export interface AddonChangeEvent {
  tenantId: string;
  addonKey: AddonKey;
  action: AddonChangeAction;
  previousState: TenantAddonState;
  newState: TenantAddonState;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  timestamp: string;
  invoiceImpact: InvoiceLineItemDelta;
}

export const patchTenantAddonBodySchema = z
  .object({
    addonKey: z.enum(ADDON_KEYS),
    enabled: z.boolean(),
    overridePrice: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
    forceImmediateDisable: z.boolean().optional(),
  })
  .strict();

export type PatchTenantAddonBody = z.infer<typeof patchTenantAddonBodySchema>;
