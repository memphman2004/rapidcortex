import { z } from "zod";

/**
 * Protocol Reconciliation Engine — shared types
 * Provisional Patent NXQ-2026-001-PROV — Claims 5, 6, 7
 */

export const stepStatusSchema = z.enum(["ACTIVE", "COMPLETED", "SUSPENDED", "SKIPPED"]);
export type StepStatus = z.infer<typeof stepStatusSchema>;

export const stepCategorySchema = z.enum([
  "SCENE_SAFETY",
  "AIRWAY",
  "BREATHING",
  "CIRCULATION",
  "CPR",
  "DEFIBRILLATION",
  "BLEEDING_CONTROL",
  "POSITIONING",
  "ENVIRONMENTAL",
  "EVACUATION",
  "COMMUNICATION",
  "MEDICATION",
  "GENERAL",
]);
export type StepCategory = z.infer<typeof stepCategorySchema>;

export const activeStepSchema = z.object({
  stepId: z.string().min(1),
  protocolId: z.string().min(1),
  cadNatureCode: z.string().min(1),
  order: z.number().int().nonnegative(),
  category: stepCategorySchema,
  text: z.string().min(1).max(2000),
  status: stepStatusSchema,
  activatedAt: z.string().min(20),
  completedAt: z.string().min(20).optional(),
  suspendedAt: z.string().min(20).optional(),
  suspensionReason: z.string().max(256).optional(),
});
export type ActiveStep = z.infer<typeof activeStepSchema>;

export const suspendedStepRecordSchema = z.object({
  stepId: z.string().min(1),
  protocolId: z.string().min(1),
  cadNatureCode: z.string().min(1),
  category: stepCategorySchema,
  text: z.string().min(1).max(2000),
  suspendedAt: z.string().min(20),
  suspensionReason: z.string().max(256),
});
export type SuspendedStepRecord = z.infer<typeof suspendedStepRecordSchema>;

export const compatibilityRuleSchema = z.object({
  compatibleCategories: z.array(stepCategorySchema),
  incompatibleCategories: z.array(stepCategorySchema),
  compatibleStepIdPrefixes: z.array(z.string()).optional(),
  incompatibleStepIdPrefixes: z.array(z.string()).optional(),
});
export type CompatibilityRule = z.infer<typeof compatibilityRuleSchema>;

export const reconciliationAuditRecordSchema = z.object({
  reconciliationId: z.string().min(1),
  incidentId: z.string().min(1),
  sessionToken: z.string().min(1),
  agencyId: z.string().min(1),
  priorNatureCode: z.string().min(1),
  newNatureCode: z.string().min(1),
  dispatcherId: z.string().min(1),
  reclassificationTimestamp: z.string().min(20),
  reconciliationTimestamp: z.string().min(20),
  suspendedSteps: z.array(suspendedStepRecordSchema),
  replacementProtocolId: z.string(),
  replacementStepCount: z.number().int().nonnegative(),
  auditHash: z.string().min(16),
});
export type ReconciliationAuditRecord = z.infer<typeof reconciliationAuditRecordSchema>;

export const reconciliationResultSchema = z.object({
  sessionToken: z.string().min(1),
  incidentId: z.string().min(1),
  priorNatureCode: z.string().min(1),
  newNatureCode: z.string().min(1),
  suspendedSteps: z.array(suspendedStepRecordSchema),
  replacementSteps: z.array(activeStepSchema),
  auditRecord: reconciliationAuditRecordSchema,
  sessionTerminated: z.boolean(),
});
export type ReconciliationResult = z.infer<typeof reconciliationResultSchema>;

export const incidentUpdatedEventSchema = z.object({
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  dispatcherId: z.string().min(1),
  priorNatureCode: z.string().min(1),
  newNatureCode: z.string().min(1),
  timestamp: z.string().min(20),
  source: z.string().min(1),
});
export type IncidentUpdatedEvent = z.infer<typeof incidentUpdatedEventSchema>;

/** Nature codes that immediately terminate a Pre-Arrival session. */
export const RESTRICTED_NATURE_CODES = [
  "ACTIVE_SHOOTER",
  "DOMESTIC",
  "HOSTAGE",
  "OFFICER_DOWN",
  "SWAT",
  "TERRORISM",
  "SHOTS_FIRED",
] as const;

export type RestrictedNatureCode = (typeof RESTRICTED_NATURE_CODES)[number];

/** Collapse spaces and punctuation so "active shooter" matches ACTIVE_SHOOTER. */
export function normalizeNatureCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function isRestrictedNatureCode(code: string): boolean {
  const normalized = normalizeNatureCode(code);
  if (!normalized) return false;
  return (RESTRICTED_NATURE_CODES as readonly string[]).some(
    (entry) => normalized === entry || normalized.startsWith(`${entry}_`) || normalized.includes(`_${entry}`),
  );
}
