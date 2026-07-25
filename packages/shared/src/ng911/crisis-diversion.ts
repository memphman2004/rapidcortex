import { z } from "zod";

/** Multi-destination crisis diversion (CSG / STAR / LA-matrix style). */
export const crisisDestinationTypeSchema = z.enum([
  "988",
  "mobile_crisis",
  "community_responder",
  "le_ems",
  "portal_sms",
]);
export type CrisisDestinationType = z.infer<typeof crisisDestinationTypeSchema>;

export const crisisHardStopReasonSchema = z.enum([
  "crime_in_progress",
  "weapons",
  "active_medical",
  "hostile_threat",
  "other_public_safety",
]);
export type CrisisHardStopReason = z.infer<typeof crisisHardStopReasonSchema>;

export const crisisAssessmentAnswerSchema = z.object({
  stepId: z.string().min(1).max(64),
  question: z.string().min(1).max(500),
  answer: z.enum(["yes", "no", "unknown"]),
  hardStopTriggered: z.boolean().default(false),
  answeredAt: z.string().min(20),
});
export type CrisisAssessmentAnswer = z.infer<typeof crisisAssessmentAnswerSchema>;

export const crisisProtocolStepSchema = z.object({
  stepId: z.string().min(1).max(64),
  sortOrder: z.number().int().min(0).max(999).default(0),
  question: z.string().min(1).max(500),
  /** If caller/dispatcher answers "yes", treat as hard stop → le_ems. */
  hardStopOnYes: z.boolean().default(false),
  hardStopReason: crisisHardStopReasonSchema.optional(),
  /** Suggested destination when answer is "no" and no hard stop earlier. */
  suggestDestinationOnNo: crisisDestinationTypeSchema.optional(),
  helpText: z.string().max(1000).optional(),
});
export type CrisisProtocolStep = z.infer<typeof crisisProtocolStepSchema>;

export const crisisDestinationSchema = z.object({
  destinationId: z.string().min(1).max(64),
  agencyId: z.string().min(1).max(128),
  type: crisisDestinationTypeSchema,
  name: z.string().min(1).max(120),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  portalUrl: z.string().url().max(2000).optional(),
  smsTemplate: z.string().max(480).optional(),
  notes: z.string().max(2000).optional(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
});
export type CrisisDestination = z.infer<typeof crisisDestinationSchema>;

export const crisisDestinationUpsertBodySchema = z.object({
  destinationId: z.string().min(1).max(64).optional(),
  type: crisisDestinationTypeSchema,
  name: z.string().min(1).max(120),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  portalUrl: z.string().url().max(2000).optional(),
  smsTemplate: z.string().max(480).optional(),
  notes: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type CrisisDestinationUpsertBody = z.infer<typeof crisisDestinationUpsertBodySchema>;

export const crisisProtocolSchema = z.object({
  protocolId: z.string().min(1).max(64),
  agencyId: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().default(true),
  /** LA-style level label (1=lowest risk … 4=highest). Optional metadata. */
  defaultRiskLevel: z.number().int().min(1).max(4).optional(),
  steps: z.array(crisisProtocolStepSchema).min(1).max(40),
  /** Fallback when assessment completes without hard stop or suggestion. */
  defaultDestination: crisisDestinationTypeSchema.default("le_ems"),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  createdBy: z.string().max(128).optional(),
});
export type CrisisProtocol = z.infer<typeof crisisProtocolSchema>;

export const crisisProtocolUpsertBodySchema = z.object({
  protocolId: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  enabled: z.boolean().optional(),
  defaultRiskLevel: z.number().int().min(1).max(4).optional(),
  steps: z.array(crisisProtocolStepSchema).min(1).max(40),
  defaultDestination: crisisDestinationTypeSchema.optional(),
});
export type CrisisProtocolUpsertBody = z.infer<typeof crisisProtocolUpsertBodySchema>;

export const crisisAgencyConfigSchema = z.object({
  agencyId: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  defaultProtocolId: z.string().max(64).optional(),
  /** Optional unit costs for savings estimates (agency-supplied). */
  unitCostAvoidedLeUsd: z.number().min(0).max(1_000_000).optional(),
  unitCostAvoidedEmsUsd: z.number().min(0).max(1_000_000).optional(),
  warmTransferMock: z.boolean().default(true),
  updatedAt: z.string().min(20),
});
export type CrisisAgencyConfig = z.infer<typeof crisisAgencyConfigSchema>;

export const crisisAgencyConfigUpsertBodySchema = z.object({
  enabled: z.boolean().optional(),
  defaultProtocolId: z.string().max(64).optional(),
  unitCostAvoidedLeUsd: z.number().min(0).max(1_000_000).optional(),
  unitCostAvoidedEmsUsd: z.number().min(0).max(1_000_000).optional(),
  warmTransferMock: z.boolean().optional(),
});
export type CrisisAgencyConfigUpsertBody = z.infer<typeof crisisAgencyConfigUpsertBodySchema>;

export const crisisWarmTransferStatusSchema = z.enum([
  "requested",
  "ringing",
  "connected",
  "completed",
  "failed",
  "cancelled",
]);
export type CrisisWarmTransferStatus = z.infer<typeof crisisWarmTransferStatusSchema>;

export const crisisWarmTransferSchema = z.object({
  transferId: z.string().min(1).max(64),
  status: crisisWarmTransferStatusSchema,
  destinationType: crisisDestinationTypeSchema,
  destinationId: z.string().max(64).optional(),
  destinationName: z.string().max(120).optional(),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  notes: z.string().max(2000).optional(),
  mock: z.boolean().default(true),
  requestedAt: z.string().min(20),
  updatedAt: z.string().min(20),
  completedAt: z.string().min(20).optional(),
});
export type CrisisWarmTransfer = z.infer<typeof crisisWarmTransferSchema>;

export const crisisAssessmentStatusSchema = z.enum([
  "in_progress",
  "hard_stopped",
  "destination_selected",
  "handoff_in_progress",
  "completed",
  "cancelled",
]);
export type CrisisAssessmentStatus = z.infer<typeof crisisAssessmentStatusSchema>;

export const crisisAssessmentSchema = z.object({
  assessmentId: z.string().min(1).max(64),
  agencyId: z.string().min(1).max(128),
  incidentId: z.string().min(1).max(128).optional(),
  protocolId: z.string().min(1).max(64),
  protocolName: z.string().max(120).optional(),
  status: crisisAssessmentStatusSchema,
  answers: z.array(crisisAssessmentAnswerSchema).max(40).default([]),
  hardStopReason: crisisHardStopReasonSchema.optional(),
  recommendedDestination: crisisDestinationTypeSchema.optional(),
  selectedDestination: crisisDestinationTypeSchema.optional(),
  selectedDestinationId: z.string().max(64).optional(),
  warmTransfer: crisisWarmTransferSchema.optional(),
  clinicianConsultId: z.string().max(64).optional(),
  outcomeNotes: z.string().max(2000).optional(),
  phoneResolved: z.boolean().optional(),
  divertedFromLe: z.boolean().optional(),
  divertedFromEms: z.boolean().optional(),
  actorId: z.string().max(128).optional(),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  completedAt: z.string().min(20).optional(),
});
export type CrisisAssessment = z.infer<typeof crisisAssessmentSchema>;

export const crisisAssessmentStartBodySchema = z.object({
  protocolId: z.string().min(1).max(64).optional(),
  incidentId: z.string().min(1).max(128).optional(),
});
export type CrisisAssessmentStartBody = z.infer<typeof crisisAssessmentStartBodySchema>;

export const crisisAssessmentAnswerBodySchema = z.object({
  assessmentId: z.string().min(1).max(64),
  stepId: z.string().min(1).max(64),
  answer: z.enum(["yes", "no", "unknown"]),
});
export type CrisisAssessmentAnswerBody = z.infer<typeof crisisAssessmentAnswerBodySchema>;

export const crisisSelectDestinationBodySchema = z.object({
  assessmentId: z.string().min(1).max(64),
  destinationType: crisisDestinationTypeSchema,
  destinationId: z.string().min(1).max(64).optional(),
  /** For portal_sms leaf. */
  callerPhoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
});
export type CrisisSelectDestinationBody = z.infer<typeof crisisSelectDestinationBodySchema>;

export const crisisWarmTransferBodySchema = z.object({
  assessmentId: z.string().min(1).max(64),
  destinationId: z.string().min(1).max(64).optional(),
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  notes: z.string().max(2000).optional(),
});
export type CrisisWarmTransferBody = z.infer<typeof crisisWarmTransferBodySchema>;

export const crisisCompleteBodySchema = z.object({
  assessmentId: z.string().min(1).max(64),
  phoneResolved: z.boolean().optional(),
  divertedFromLe: z.boolean().optional(),
  divertedFromEms: z.boolean().optional(),
  outcomeNotes: z.string().max(2000).optional(),
});
export type CrisisCompleteBody = z.infer<typeof crisisCompleteBodySchema>;

export const clinicianConsultStatusSchema = z.enum([
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
  "escalated_le",
]);
export type ClinicianConsultStatus = z.infer<typeof clinicianConsultStatusSchema>;

export const clinicianConsultSchema = z.object({
  consultId: z.string().min(1).max(64),
  agencyId: z.string().min(1).max(128),
  assessmentId: z.string().min(1).max(64),
  incidentId: z.string().max(128).optional(),
  status: clinicianConsultStatusSchema,
  summary: z.string().max(2000).optional(),
  assignedTo: z.string().max(128).optional(),
  notes: z.string().max(4000).optional(),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  completedAt: z.string().min(20).optional(),
});
export type ClinicianConsult = z.infer<typeof clinicianConsultSchema>;

export const clinicianConsultPatchBodySchema = z.object({
  status: clinicianConsultStatusSchema.optional(),
  assignedTo: z.string().max(128).optional(),
  notes: z.string().max(4000).optional(),
});
export type ClinicianConsultPatchBody = z.infer<typeof clinicianConsultPatchBodySchema>;

export const partnerEidoHandoffBodySchema = z.object({
  incidentId: z.string().min(1).max(128),
  partnerAgencyId: z.string().min(1).max(128),
  partnerWebhookUrl: z.string().url().max(2000).optional(),
  includeAdditionalData: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});
export type PartnerEidoHandoffBody = z.infer<typeof partnerEidoHandoffBodySchema>;

export const partnerEidoHandoffResultSchema = z.object({
  handoffId: z.string(),
  incidentId: z.string(),
  partnerAgencyId: z.string(),
  status: z.enum(["stored", "delivered_mock", "delivered", "failed"]),
  eidoId: z.string().optional(),
  deliveredAt: z.string().optional(),
  error: z.string().optional(),
});
export type PartnerEidoHandoffResult = z.infer<typeof partnerEidoHandoffResultSchema>;

/** 911 DataPath-inspired element dictionary for RC assist evidence exports. */
export const dataPathElementSchema = z.object({
  elementId: z.string(),
  label: z.string(),
  category: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  source: z.string().optional(),
});
export type DataPathElement = z.infer<typeof dataPathElementSchema>;

export const dataPathExportSchema = z.object({
  agencyId: z.string(),
  packVersion: z.string().default("RC-DATAPATH-ASSIST-1.0"),
  generatedAt: z.string().min(20),
  period: z.object({ from: z.string(), to: z.string() }),
  disclaimer: z.string(),
  elements: z.array(dataPathElementSchema),
});
export type DataPathExport = z.infer<typeof dataPathExportSchema>;
