import { z } from "zod";
import { interpolateCallAssistVoice } from "./voice-config.js";

/** Agency operational context. Each vertical has a default taxonomy agencies can customize. */
export const CALL_ASSIST_TAXONOMY_VERTICALS = ["911", "campus", "venue"] as const;
export type CallAssistTaxonomyVertical = (typeof CALL_ASSIST_TAXONOMY_VERTICALS)[number];

export const CALL_ASSIST_ESCALATION_PATHS = [
  "emergency",
  "dispatcher",
  "external",
  "self_service",
] as const;
export type CallAssistEscalationPath = (typeof CALL_ASSIST_ESCALATION_PATHS)[number];

export const CALL_ASSIST_INTAKE_FIELD_TYPES = ["text", "select", "boolean", "number"] as const;
export type CallAssistIntakeFieldType = (typeof CALL_ASSIST_INTAKE_FIELD_TYPES)[number];

export const callAssistFollowUpQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  prompt: z.string().min(1).max(500),
  promptEs: z.string().min(1).max(500).optional(),
  fieldId: z.string().min(1).max(64),
  policy: z.enum(["ask", "clarify", "skip", "never_repeat"]).optional(),
  condition: z
    .object({
      fieldId: z.string().min(1).max(64),
      value: z.string().min(1).max(120),
    })
    .optional(),
});
export type FollowUpQuestion = z.infer<typeof callAssistFollowUpQuestionSchema>;

export const callAssistIntakeFieldSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  type: z.enum(CALL_ASSIST_INTAKE_FIELD_TYPES),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(80)).max(40).optional(),
  alertOnValue: z.string().max(80).optional(),
  placeholder: z.string().max(120).optional(),
  helpText: z.string().max(240).optional(),
});
export type IntakeField = z.infer<typeof callAssistIntakeFieldSchema>;

export const callAssistIntakeTemplateSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  fields: z.array(callAssistIntakeFieldSchema).min(1).max(40),
});
export type IntakeTemplate = z.infer<typeof callAssistIntakeTemplateSchema>;

export const callAssistCallTypeSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(80),
  vertical: z.array(z.enum(CALL_ASSIST_TAXONOMY_VERTICALS)).min(1),
  cadNatureCode: z.string().max(32).nullable(),
  defaultPriority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  escalationPath: z.enum(CALL_ASSIST_ESCALATION_PATHS),
  intakeTemplateId: z.string().min(1).max(64),
  followUpQuestions: z.array(callAssistFollowUpQuestionSchema).max(20),
  classifierKeywords: z.array(z.string().min(1).max(80)).max(40),
  isEmergency: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(500),
});
export type CallType = z.infer<typeof callAssistCallTypeSchema>;

export const callAssistAgencyTaxonomySchema = z.object({
  vertical: z.enum(CALL_ASSIST_TAXONOMY_VERTICALS),
  callTypes: z.array(callAssistCallTypeSchema).min(1).max(80),
  intakeTemplates: z.array(callAssistIntakeTemplateSchema).min(1).max(20),
  defaultIntakeTemplateId: z.string().min(1).max(64),
});
export type AgencyTaxonomy = z.infer<typeof callAssistAgencyTaxonomySchema>;

export const callAssistConfidenceThresholdsSchema = z.object({
  emergency: z.number().min(0.5).max(0.9),
  escalate: z.number().min(0.1).max(0.95),
  selfService: z.number().min(0.5).max(0.99),
});
export type CallAssistConfidenceThresholds = z.infer<typeof callAssistConfidenceThresholdsSchema>;

export const DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS: CallAssistConfidenceThresholds = {
  emergency: 0.7,
  escalate: 0.55,
  selfService: 0.8,
};

export const callAssistExternalTransferEntrySchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    number: z.string().max(32).default(""),
    sipUri: z.string().max(256).nullable().optional(),
    acceptedCallTypes: z.array(z.string().min(1).max(64)).max(40).optional(),
    fallbackNumber: z.string().max(32).nullable().optional(),
    afterHoursMessage: z.string().max(500).nullable().optional(),
    warmTransferScript: z.string().max(1000).nullable().optional(),
  })
  .refine((row) => Boolean(row.number?.trim() || row.sipUri?.trim()), {
    message: "PSTN number or SIP URI is required",
    path: ["number"],
  });
export type CallAssistExternalTransferEntry = z.infer<typeof callAssistExternalTransferEntrySchema>;

export const callAssistDemoScenarioConfigSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  utterances: z.array(z.string().min(1).max(8000)).min(1).max(8),
  expectedClass: z.string().min(1).max(64),
  vertical: z.enum(CALL_ASSIST_TAXONOMY_VERTICALS),
  source: z.enum(["preset", "custom"]),
  enabled: z.boolean().default(true),
});
export type CallAssistDemoScenarioConfig = z.infer<typeof callAssistDemoScenarioConfigSchema>;

export const callAssistOperatingDaySchema = z.object({
  day: z.number().int().min(0).max(6),
  closed: z.boolean(),
  openMinutes: z.number().int().min(0).max(24 * 60),
  closeMinutes: z.number().int().min(0).max(24 * 60),
});

export function cloneAgencyTaxonomy(taxonomy: AgencyTaxonomy): AgencyTaxonomy {
  return structuredClone(taxonomy);
}

export function unknownCallType(vertical: CallAssistTaxonomyVertical, intakeTemplateId: string): CallType {
  const id = vertical === "911" ? "UNKNOWN" : "unknown";
  return {
    id,
    label: "Unknown",
    vertical: [vertical],
    cadNatureCode: null,
    defaultPriority: 3,
    escalationPath: "dispatcher",
    intakeTemplateId,
    followUpQuestions: [],
    classifierKeywords: [],
    isEmergency: false,
    enabled: true,
    sortOrder: 999,
  };
}

function ensureUnknownType(taxonomy: AgencyTaxonomy): AgencyTaxonomy {
  const expectedId = taxonomy.vertical === "911" ? "UNKNOWN" : "unknown";
  const existing = taxonomy.callTypes.find((t) => t.id === expectedId || t.id.toLowerCase() === "unknown");
  if (existing) {
    existing.enabled = true;
    return taxonomy;
  }
  taxonomy.callTypes.push(unknownCallType(taxonomy.vertical, taxonomy.defaultIntakeTemplateId));
  return taxonomy;
}

export function findCallType(taxonomy: AgencyTaxonomy, id: string | null | undefined): CallType | undefined {
  if (!id) return undefined;
  return taxonomy.callTypes.find((t) => t.id === id);
}

export function enabledCallTypes(taxonomy: AgencyTaxonomy): CallType[] {
  return taxonomy.callTypes.filter((t) => t.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Emergency types cannot be removed, disabled, or unmarked.
 * Safety-engine TRANSFER_911 is not configurable; this only protects taxonomy rows.
 */
export function validateTaxonomyEmergencyLocks(
  baseline: AgencyTaxonomy,
  next: AgencyTaxonomy,
): string | null {
  for (const prev of baseline.callTypes.filter((t) => t.isEmergency)) {
    const row = next.callTypes.find((t) => t.id === prev.id);
    if (!row) return "Emergency types cannot be removed.";
    if (!row.enabled) return "Emergency types cannot be disabled.";
    if (!row.isEmergency) return "Emergency types cannot be unmarked.";
  }
  return null;
}

export function clampEmergencyThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.emergency;
  return Math.min(0.9, Math.max(0.5, value));
}

export function normalizeConfidenceThresholds(
  input?: Partial<CallAssistConfidenceThresholds> | null,
): CallAssistConfidenceThresholds {
  return {
    emergency: clampEmergencyThreshold(input?.emergency ?? DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.emergency),
    escalate: Number.isFinite(input?.escalate)
      ? Math.min(0.95, Math.max(0.1, input!.escalate as number))
      : DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.escalate,
    selfService: Number.isFinite(input?.selfService)
      ? Math.min(0.99, Math.max(0.5, input!.selfService as number))
      : DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.selfService,
  };
}

export function substituteAgencyShortName(template: string, shortName: string): string {
  return interpolateCallAssistVoice(template, { agencyShortName: shortName });
}

export function isCallAssistOnboardingComplete(config: { onboardingComplete?: boolean }): boolean {
  return config.onboardingComplete !== false;
}

export function isCallAssistActivationReady(config: {
  onboardingComplete?: boolean;
  greetingReady?: boolean;
  greetingActivationBlocked?: string | null;
}): boolean {
  if (!isCallAssistOnboardingComplete(config)) return false;
  if (config.greetingReady === false) return false;
  if (config.greetingActivationBlocked) return false;
  return true;
}

export function classificationLabel(taxonomy: AgencyTaxonomy | null | undefined, id: string | null | undefined): string {
  if (!id) return "Unknown";
  const row = taxonomy ? findCallType(taxonomy, id) : undefined;
  if (row?.label) return row.label;
  return id
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
