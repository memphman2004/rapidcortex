import type { SlaThreshold } from "../sla-types.js";
import type { CampusAgencyConfig } from "./campus-config.js";

export type AgencyIntegrationMode =
  | "none"
  | "demo_only"
  | "mock_adapters"
  | "live_transcript"
  | "cad_read_only"
  | "bidirectional";

export type EnvironmentFlags = Record<string, boolean | string | number>;

export type BrandingConfig = {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
};

/** F4 — SOP document + auto protocol surfacing. */
export type SopAgencyConfig = {
  autoDetectEnabled: boolean;
  /** Object key within the shared assets bucket, typically `agency-sop/{agencyId}/...`. */
  sopDocumentS3Key?: string;
};

/** F3 — non-emergency triage assist. */
export type TriageAgencyConfig = {
  enabled: boolean;
  nonEmergencyQueueEnabled?: boolean;
};

/** F5 — dispatcher load / trauma keyword surfacing for supervisors only. */
export type WellnessAgencyConfig = {
  enabled: boolean;
  keywords: string[];
};

/** Rapid Cortex staff onboarding checklist (stored per agency, platform-managed). */
export const PLATFORM_ONBOARDING_STEP_IDS = [
  "tenant_created",
  "first_admin",
  "cognito_ready",
  "dns_web",
  "ses",
  "sms",
  "live_video",
  "cad",
  "training",
  "go_live",
] as const;

export type PlatformOnboardingStepId = (typeof PLATFORM_ONBOARDING_STEP_IDS)[number];

export type PlatformOnboardingStepStatus = "pending" | "in_progress" | "complete" | "blocked";

export type PlatformOnboardingState = {
  steps: Partial<Record<PlatformOnboardingStepId, PlatformOnboardingStepStatus>>;
  notesByStep?: Partial<Record<PlatformOnboardingStepId, string>>;
  /** Free-form note for the agency row in platform UI. */
  agencyNote?: string;
  updatedAt?: string;
};

/** Optional per–data-type retention overrides (days). When unset, deployment defaults apply. */
export type RetentionOverrideDays = {
  incident?: number;
  transcript?: number;
  media?: number;
  analysis?: number;
};

/**
 * Mutable agency operational configuration (embedded on `AgencyTenant` in v1).
 */
export interface AgencyConfig {
  agencyId: string;
  protocolPackId: string;
  aiProviderProfileId: string;
  retentionPolicyId: string;
  integrationMode: AgencyIntegrationMode;
  transcriptRedactionEnabled: boolean;
  auditExportEnabled: boolean;
  environmentFlags: EnvironmentFlags;
  branding?: BrandingConfig;
  sop?: SopAgencyConfig;
  triage?: TriageAgencyConfig;
  wellness?: WellnessAgencyConfig;
  /** Campus vertical — display, notifications, escalation, and public QR report form. */
  campus?: CampusAgencyConfig;
  /** Platform (Rapid Cortex) onboarding tracker — not used by agency admins in product UI. */
  platformOnboarding?: PlatformOnboardingState;
  /** CJIS-style retention: days per category; merged with stack defaults. */
  retentionOverrideDays?: RetentionOverrideDays;
  /** Free-form JSON-safe rules blob — normalize in a later pass. */
  supervisorEscalationRules: Record<string, unknown>;
  /** Per-priority SLA answer/dispatch targets (defaults apply when unset). */
  slaThresholds?: SlaThreshold[];
  createdAt: string;
  updatedAt: string;
}
