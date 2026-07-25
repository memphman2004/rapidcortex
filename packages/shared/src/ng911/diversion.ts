import { z } from "zod";

/** Agency-configured non-emergency diversion workflow (Arlington-style). */
export const diversionWorkflowSchema = z.object({
  workflowId: z.string().min(1).max(64),
  agencyId: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  /** Utterance phrases / intents that match this workflow (case-insensitive). */
  intents: z.array(z.string().min(1).max(200)).min(1).max(80),
  /** Public portal / online reporting URL sent via SMS when caller confirms. */
  portalUrl: z.string().url().max(2000),
  smsTemplate: z
    .string()
    .max(480)
    .optional()
    .describe("Optional SMS body; {portalUrl} and {workflowName} are substituted"),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  createdBy: z.string().max(128).optional(),
});
export type DiversionWorkflow = z.infer<typeof diversionWorkflowSchema>;

export const diversionWorkflowUpsertBodySchema = z.object({
  workflowId: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  intents: z.array(z.string().min(1).max(200)).min(1).max(80),
  portalUrl: z.string().url().max(2000),
  smsTemplate: z.string().max(480).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type DiversionWorkflowUpsertBody = z.infer<typeof diversionWorkflowUpsertBodySchema>;

export const diversionAgencyConfigSchema = z.object({
  agencyId: z.string().min(1).max(128),
  /** Public key presented by Connect / web IVR (plain shown once; store hash). */
  publicKeyHash: z.string().min(16).max(128),
  publicKeyHint: z.string().max(12).optional(),
  greeting: z
    .string()
    .max(500)
    .default(
      "You have reached the non-emergency line. If this is an emergency, hang up and dial 9-1-1.",
    ),
  enabled: z.boolean().default(true),
  updatedAt: z.string().min(20),
});
export type DiversionAgencyConfig = z.infer<typeof diversionAgencyConfigSchema>;

export const diversionSessionStatusSchema = z.enum([
  "started",
  "utterance_collected",
  "matched",
  "awaiting_confirm",
  "sms_sent",
  "completed",
  "opted_out",
  "no_match",
  "failed",
]);
export type DiversionSessionStatus = z.infer<typeof diversionSessionStatusSchema>;

export const diversionSessionSchema = z.object({
  sessionId: z.string().min(1).max(64),
  agencyId: z.string().min(1).max(128),
  status: diversionSessionStatusSchema,
  callerPhoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  utterance: z.string().max(1000).optional(),
  matchedWorkflowId: z.string().max(64).optional(),
  matchedWorkflowName: z.string().max(120).optional(),
  smsProviderRef: z.string().max(128).optional(),
  queueIncidentId: z.string().max(128).optional(),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  completedAt: z.string().min(20).optional(),
});
export type DiversionSession = z.infer<typeof diversionSessionSchema>;

export const diversionStartBodySchema = z.object({
  callerPhoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
});
export type DiversionStartBody = z.infer<typeof diversionStartBodySchema>;

export const diversionUtteranceBodySchema = z.object({
  sessionId: z.string().min(1).max(64),
  utterance: z.string().min(1).max(1000),
});
export type DiversionUtteranceBody = z.infer<typeof diversionUtteranceBodySchema>;

export const diversionConfirmBodySchema = z.object({
  sessionId: z.string().min(1).max(64),
  /** true = send SMS with portal link; false = opt out to live queue */
  confirm: z.boolean(),
  callerPhoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
});
export type DiversionConfirmBody = z.infer<typeof diversionConfirmBodySchema>;

export const diversionUtteranceResultSchema = z.object({
  sessionId: z.string(),
  status: diversionSessionStatusSchema,
  matched: z.boolean(),
  workflowId: z.string().optional(),
  workflowName: z.string().optional(),
  confirmPrompt: z.string().optional(),
  message: z.string(),
});
export type DiversionUtteranceResult = z.infer<typeof diversionUtteranceResultSchema>;

export const diversionConfirmResultSchema = z.object({
  sessionId: z.string(),
  status: diversionSessionStatusSchema,
  smsSent: z.boolean().optional(),
  portalUrl: z.string().url().optional(),
  queueIncidentId: z.string().optional(),
  message: z.string(),
});
export type DiversionConfirmResult = z.infer<typeof diversionConfirmResultSchema>;
