import { z } from "zod";
import { FIELD_WORKSPACE_IDS, FIELD_ACCESS_TOOL_IDS } from "./workspaces.js";

export const fieldWorkspaceIdSchema = z.enum(FIELD_WORKSPACE_IDS);
export const fieldAccessToolIdSchema = z.enum(FIELD_ACCESS_TOOL_IDS);

export const fieldAccessRequestBodySchema = z.object({
  requestedWorkspace: z.string().min(1).max(80),
  requestedWorkspaceTitle: z.string().min(1).max(80).optional(),
  /** Ignored server-side — agencyId always comes from the JWT. */
  agencyId: z.string().max(128).optional(),
  /** Ignored server-side — email always comes from the JWT. */
  userEmail: z.string().max(320).optional(),
  reason: z.string().max(2000).optional().default(""),
});
export type FieldAccessRequestBody = z.infer<typeof fieldAccessRequestBodySchema>;

export const FIELD_COACHING_CATEGORIES = [
  "call_control",
  "questioning",
  "de_escalation",
  "protocol",
  "communication",
  "positive",
] as const;
export type FieldCoachingCategory = (typeof FIELD_COACHING_CATEGORIES)[number];

export const fieldCoachingNoteBodySchema = z.object({
  incidentId: z.string().min(1).max(128).optional(),
  dispatcherUserId: z.string().max(128).optional().default(""),
  category: z.enum(FIELD_COACHING_CATEGORIES),
  observation: z.string().min(1).max(8000),
  discussInNextReview: z.boolean().optional().default(false),
  addToQaQueue: z.boolean().optional().default(false),
  positiveRecognition: z.boolean().optional().default(false),
});
export type FieldCoachingNoteBody = z.infer<typeof fieldCoachingNoteBodySchema>;

export const FIELD_CONTINUITY_CATEGORIES = [
  "ops",
  "staffing",
  "equipment",
  "incident",
  "other",
] as const;
export type FieldContinuityCategory = (typeof FIELD_CONTINUITY_CATEGORIES)[number];

export const fieldContinuityLogBodySchema = z.object({
  category: z.enum(FIELD_CONTINUITY_CATEGORIES),
  text: z.string().min(1).max(4000),
  critical: z.boolean().optional().default(false),
});
export type FieldContinuityLogBody = z.infer<typeof fieldContinuityLogBodySchema>;

export const fieldIncidentMessageBodySchema = z.object({
  text: z.string().min(1).max(4000),
});
export type FieldIncidentMessageBody = z.infer<typeof fieldIncidentMessageBodySchema>;
