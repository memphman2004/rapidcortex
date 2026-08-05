import { z } from "zod";
import {
  RCS_AUDIO_STATUSES,
  RCS_CALL_STATES,
  RCS_ESCALATION_LEVELS,
} from "./types.js";

export const rcsCallStateSchema = z.enum(RCS_CALL_STATES);
export const rcsEscalationLevelSchema = z.enum(RCS_ESCALATION_LEVELS);
export const rcsAudioStatusSchema = z.enum(RCS_AUDIO_STATUSES);

export const rcsGeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const rcsCallStartBodySchema = z.object({
  incidentId: z.string().trim().min(1).max(128).optional(),
  callerPhone: z.string().trim().min(3).max(32).optional(),
  location: rcsGeoPointSchema.optional(),
  arrivalRadiusMeters: z.number().int().min(10).max(5000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const rcsCallStateUpdateBodySchema = z.object({
  state: rcsCallStateSchema,
  notes: z.string().trim().max(2000).optional(),
});

/** Closure gate: supervisor override requires badge + reason >= 20 chars; dispatchers may not override. */
export const rcsSupervisorOverrideSchema = z.object({
  badge: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(20).max(2000),
});

export const rcsCallCloseBodySchema = z.object({
  supervisorOverride: rcsSupervisorOverrideSchema.optional(),
});

export const rcsAudioAlertBodySchema = z.object({
  audioStatus: rcsAudioStatusSchema,
  detail: z.string().trim().max(2000).optional(),
});

export const rcsUnitPositionBodySchema = z.object({
  unitId: z.string().trim().min(1).max(128),
  callSign: z.string().trim().min(1).max(64).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  callId: z.string().trim().min(1).max(128).optional(),
});

export const rcsSupervisorAckBodySchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export const rcsCallsListQuerySchema = z.object({
  state: rcsCallStateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

// ─── Intelligence layer ───────────────────────────────────────────────────────

export const RCS_CONCERN_KEYWORDS = [
  "weapon",
  "unconscious",
  "no_response",
  "fire",
  "explosion",
  "medical_critical",
  "children_involved",
  "suspect_fleeing",
  "multiple_victims",
  "officer_down",
  "structure_collapse",
  "chemical_hazard",
  "prolonged_silence",
  "unit_overdue",
] as const;

export const rcsSoftHandoffRequestSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const rcsSoftHandoffAcceptRequestSchema = z
  .object({
    acceptorDisplayName: z.string().trim().min(1).max(128),
  })
  .strict();

export const rcsEscalationRulesPutSchema = z
  .object({
    dispatchedWithoutArrivalSeconds: z.number().int().min(60).max(3600),
    level1UnackedSeconds: z.number().int().min(60).max(3600),
    level2UnackedSeconds: z.number().int().min(60).max(3600),
    audioSilenceAlertSeconds: z.number().int().min(10).max(300),
    supervisorPushOnEscalation: z.boolean(),
  })
  .strict();

export const rcsAiSummarySchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    /** ISO timestamp — flexible string (offset optional). */
    generatedAt: z.string().trim().min(1),
    concernKeywords: z.array(z.string().trim().min(1).max(64)).max(20),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const rcsFloorHealthQuerySchema = z.object({
  agencyId: z.string().trim().min(1).max(128).optional(),
});
