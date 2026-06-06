import { z } from "zod";
import { cadPrioritySchema } from "./cad.js";
import { protocolGuidanceSchema } from "./protocol/guidance-schema.js";
import { triageResultSchema } from "./triage/triage.js";

// --- Incident (HTTP) ----------------------------------------------------------

/** Optional CAD mirror fields (create path); same vocabulary as {@link Incident} CAD props. */
export const createIncidentCadFieldsSchema = z.object({
  cadIncidentId: z.string().min(1).max(200).optional(),
  cadSystem: z.enum(["motorola", "tyler", "centralsquare", "hexagon", "generic"]).optional(),
  cadRevision: z.number().int().nonnegative().optional(),
  cadVendorRevisionLast: z.number().int().nonnegative().optional(),
  cadLastSyncAt: z.string().min(1).max(64).optional(),
  cadRawPayload: z.string().max(500_000).optional(),
  cadStatus: z.string().min(1).max(200).optional(),
  cadPriority: z.string().min(1).max(120).optional(),
  cadNatureCode: z.string().min(1).max(200).optional(),
  cadLocation: z.string().min(1).max(2000).optional(),
  cadUnits: z.array(z.string().min(1).max(64)).max(200).optional(),
  cadCoordinates: z
    .object({
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
    })
    .optional(),
  cadDedupeKey: z.string().min(1).max(400).optional(),
  cadCallerName: z.string().min(1).max(200).nullable().optional(),
  cadCallerCallbackMasked: z.string().min(1).max(64).nullable().optional(),
});

export const createIncidentSchema = z
  .object({
    title: z.string().min(3),
    source: z.enum(["demo", "manual", "stream", "cad"]).default("manual"),
    callerAddressLine: z.string().min(1).max(500).optional(),
  })
  .merge(createIncidentCadFieldsSchema);

/** Normalized envelope for CAD webhook / integration payloads (validation before vendor parse). */
export const cadWebhookPayloadSchema = z.object({
  agencyId: z.string().min(1).max(120),
  integrationId: z.string().min(1).max(120),
  vendor: z.string().min(1).max(120),
  eventType: z.enum(["incident.created", "incident.updated", "incident.closed", "unit.status"]),
  timestamp: z.string().min(1).max(64),
  payload: z.unknown(),
  signature: z.string().min(1).max(2048).optional(),
});

export type CadWebhookPayload = z.infer<typeof cadWebhookPayloadSchema>;

/** Body for `PATCH /api/incidents/:id` — dispatcher quick actions (one field per request). */
/** Admin-only: place or clear a legal hold (blocks automated CJI purges). */
export const patchIncidentLegalHoldSchema = z
  .object({
    legalHold: z.boolean(),
    legalHoldReason: z.string().min(1).max(2000).nullable().optional(),
  })
  .strict();

export type PatchIncidentLegalHoldBody = z.infer<typeof patchIncidentLegalHoldSchema>;

export const patchIncidentDispatcherSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_reviewed") }),
  z.object({ action: z.literal("escalate_supervisor") }),
  z.object({ action: z.literal("sop_dismiss") }),
  z.object({ action: z.literal("sop_clear_override") }),
  z.object({
    action: z.literal("sop_override"),
    protocolPackId: z.string().min(1).max(120),
  }),
  z.object({
    action: z.literal("sop_toggle_step"),
    stepId: z.string().min(1).max(120),
    completed: z.boolean(),
  }),
  z.object({
    action: z.literal("caller_address"),
    addressLine: z.string().min(1).max(500),
  }),
  z.object({
    action: z.literal("cad_workspace_save"),
    summary: z.string().max(500).optional(),
    cadNatureCode: z.string().max(200).optional(),
    cadPriority: cadPrioritySchema.optional(),
    cadLocation: z.string().max(2000).optional(),
    cadUnits: z.array(z.string().min(1).max(64)).max(40).optional(),
    cadCallerName: z.string().max(120).optional(),
    cadCallerCallback: z.string().max(40).optional(),
  }),
]);
export type PatchIncidentDispatcherBody = z.infer<typeof patchIncidentDispatcherSchema>;

// --- Shared enums (single source for Zod + API provider output validation) ---

export const incidentCategorySchema = z.enum([
  "medical",
  "fire",
  "police",
  "welfare_check",
  "domestic_disturbance",
  "unknown",
]);

export const urgencyLevelSchema = z.enum(["critical", "high", "moderate", "low"]);

// --- Transcript --------------------------------------------------------------

const languageAlternativeSchema = z.object({
  language: z.string().min(1).max(16),
  confidence: z.number().min(0).max(1),
});

export const transcriptChunkMultilingualExtensionSchema = z.object({
  callSessionId: z.string().min(1).optional(),
  /** BCP-47 primary subtag (e.g. `es`, `zh`) when known. */
  originalLanguage: z.string().min(2).max(16).optional(),
  detectedLanguage: z.string().min(2).max(16).optional(),
  languageAlternatives: z.array(languageAlternativeSchema).max(8).optional(),
  /** Source-language transcript; when present with non-English language, server may translate into `text`. */
  originalTranscript: z.string().optional(),
  originalTranscriptConfidence: z.number().min(0).max(1).optional(),
  /** Echo of English line (optional; server sets from translation pipeline). */
  translatedEnglishTranscript: z.string().optional(),
  isPartial: z.boolean().optional(),
  isFinal: z.boolean().optional(),
  segmentIndex: z.number().int().nonnegative().optional(),
  startTimeMs: z.number().nonnegative().optional(),
  endTimeMs: z.number().nonnegative().optional(),
  sttLatencyMs: z.number().nonnegative().optional(),
  translationLatencyMs: z.number().nonnegative().optional(),
  sttFallbackUsed: z.boolean().optional(),
  translationFallbackUsed: z.boolean().optional(),
  chunkSource: z.enum(["manual", "voice_upload", "telephony_bridge", "demo"]).optional(),
  sttProviderUsed: z.string().min(1).optional(),
  sttProviderRequestId: z.string().min(1).max(256).optional(),
  sttModelUsed: z.string().min(1).optional(),
  translationModelUsed: z.string().min(1).optional(),
  transcriptConfidence: z.number().min(0).max(1).optional(),
});

/**
 * Request body for `POST /incidents/:id/transcript` — server assigns `segmentId`, `incidentId`, and `agencyId`.
 * **`text`** must be English for AI when multilingual mode is on; provide **`originalTranscript`** for non-English.
 * Legacy clients: send **`text`** only (English/caller language as today).
 */
export const transcriptChunkInputSchema = transcriptChunkMultilingualExtensionSchema
  .merge(
    z.object({
      speaker: z.enum(["caller", "dispatcher", "system", "unknown"]),
      text: z.string().min(1).optional(),
      timestamp: z.string().min(1).optional(),
    }),
  )
  .superRefine((v, ctx) => {
    const t = v.text?.trim() ?? "";
    const o = v.originalTranscript?.trim() ?? "";
    if (!t && !o) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either text or originalTranscript is required",
        path: ["text"],
      });
    }
  });

/** @deprecated Use `transcriptChunkInputSchema`; kept as stable import for API handlers. */
export const transcriptSegmentSchema = transcriptChunkInputSchema;

const transcriptSegmentMetadataSchema = z.object({
  segmentIndex: z.number().int().nonnegative().optional(),
  callSessionId: z.string().min(1).optional(),
  originalLanguage: z.string().min(2).max(16).optional(),
  detectedLanguage: z.string().min(2).max(16).optional(),
  languageAlternatives: z.array(languageAlternativeSchema).max(8).optional(),
  languageConfidence: z.number().min(0).max(1).optional(),
  originalTranscript: z.string().optional(),
  originalTranscriptConfidence: z.number().min(0).max(1).optional(),
  translatedEnglishTranscript: z.string().optional(),
  translationConfidence: z.number().min(0).max(1).optional(),
  sttProviderUsed: z.string().min(1).optional(),
  sttProviderRequestId: z.string().min(1).max(256).optional(),
  sttModelUsed: z.string().min(1).optional(),
  translationProviderUsed: z.string().min(1).optional(),
  translationModelUsed: z.string().min(1).optional(),
  transcriptConfidence: z.number().min(0).max(1).optional(),
  isPartial: z.boolean().optional(),
  isFinal: z.boolean().optional(),
  needsInterpreterReview: z.boolean().optional(),
  lowConfidence: z.boolean().optional(),
  updatedAt: z.string().min(1).optional(),
  chunkSource: z.enum(["manual", "voice_upload", "telephony_bridge", "demo"]).optional(),
  startTimeMs: z.number().nonnegative().optional(),
  endTimeMs: z.number().nonnegative().optional(),
  sttLatencyMs: z.number().nonnegative().optional(),
  translationLatencyMs: z.number().nonnegative().optional(),
  sttFallbackUsed: z.boolean().optional(),
  translationFallbackUsed: z.boolean().optional(),
});

/**
 * Full persisted transcript row (Dynamo / list responses) — validates all required ids.
 */
export const transcriptSegmentRecordSchema = z
  .object({
    segmentId: z.string().min(1),
    incidentId: z.string().min(1),
    agencyId: z.string().min(1),
    speaker: z.enum(["caller", "dispatcher", "system", "unknown"]),
    text: z.string().min(1),
    timestamp: z.string().min(1),
  })
  .merge(transcriptSegmentMetadataSchema.partial());

export const startLanguageSessionBodySchema = z.object({
  preferredLanguageHint: z.string().min(2).max(16).optional(),
});

export const finalizeLanguageSessionBodySchema = z.object({
  sessionId: z.string().min(1),
});

export const translateLanguageSessionBodySchema = z.object({
  text: z.string().trim().min(1).max(10_000),
  targetLanguage: z.string().min(2).max(16),
  sourceLanguage: z.string().min(2).max(16).optional(),
  sessionId: z.string().min(1).optional(),
});

export const postCallAudioChunkBodySchema = z.object({
  sessionId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  audioBase64: z.string().min(1),
  format: z.enum(["pcm16le", "wav", "webm", "opaque"]),
  durationMs: z.number().positive().optional(),
  speaker: z.enum(["caller", "dispatcher", "system", "unknown"]).optional(),
});

export type PostCallAudioChunkBody = z.infer<typeof postCallAudioChunkBodySchema>;
export type FinalizeLanguageSessionBody = z.infer<typeof finalizeLanguageSessionBodySchema>;
export type StartLanguageSessionBody = z.infer<typeof startLanguageSessionBodySchema>;
export type TranslateLanguageSessionBody = z.infer<typeof translateLanguageSessionBodySchema>;
export type TranscriptChunkInput = z.infer<typeof transcriptChunkInputSchema>;

// --- AI analysis -------------------------------------------------------------

export const analyzeIncidentSchema = z.object({
  mode: z.enum(["latest", "full"]).default("full"),
});

export const aiProviderAttemptRecordSchema = z.object({
  tierIndex: z.number().int().min(0),
  providerKind: z.enum(["openai", "anthropic", "bedrock", "mock"]),
  adapterName: z.string().min(1),
  model: z.string().min(1),
  outcome: z.enum(["success", "failed"]),
  errorCode: z.string().min(1).optional(),
  latencyMs: z.number().nonnegative().optional(),
});

/**
 * Persisted `AIAnalysis` document shape (includes metadata not produced directly by LLM JSON).
 */
export const analysisRecordKindSchema = z.enum(["dispatch", "triage"]);

export const aiAnalysisRecordSchema = z.object({
  analysisId: z.string().min(1),
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  analysisRecordKind: analysisRecordKindSchema.optional(),
  nonEmergencyTriage: triageResultSchema.optional(),
  category: incidentCategorySchema,
  urgency: urgencyLevelSchema,
  confidence: z.number().min(0).max(1),
  nextQuestion: z.string().min(1),
  recommendedAction: z.string().min(1),
  summary: z.string().min(1),
  rationale: z.string().min(1),
  escalationFlag: z.boolean(),
  provider: z.string().min(1),
  createdAt: z.string().min(1),
  protocolGuidance: protocolGuidanceSchema.optional(),
  providerUsed: z.string().min(1).optional(),
  modelUsed: z.string().min(1).optional(),
  promptVersion: z.string().min(1).optional(),
  analysisLatencyMs: z.number().nonnegative().optional(),
  fallbackCount: z.number().int().nonnegative().optional(),
  providerAttemptChain: z.array(aiProviderAttemptRecordSchema).optional(),
  analysisStatus: z.enum(["success", "partial", "failed"]).optional(),
  failureCategory: z.string().min(1).optional(),
  rawProviderResponseId: z.string().min(1).optional(),
  analyzedAt: z.string().min(1).optional(),
  transcriptSegmentCountAtAnalysis: z.number().int().nonnegative().optional(),
  triggerType: z.enum(["manual", "auto"]).optional(),
  triggeredByUserId: z.string().min(1).optional(),
  transcriptFingerprintAtAnalysis: z.string().min(1).optional(),
});

// --- Audit -------------------------------------------------------------------

export const auditResourceTypeSchema = z.enum([
  "incident",
  "transcript",
  "analysis",
  "user",
  "agency",
  "billing",
  "integration",
  "session",
  "unknown",
]);

export const auditEventSchema = z.object({
  eventId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1).optional(),
  actorId: z.string().min(1).optional(),
  type: z.string().min(1),
  details: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
  resourceType: auditResourceTypeSchema.optional(),
  resourceId: z.string().min(1).optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

// --- Parse helpers (strict runtime boundaries) ------------------------------

export class ContractValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "ContractValidationError";
  }
}

export function parseTranscriptSegmentRecord(data: unknown) {
  const parsed = transcriptSegmentRecordSchema.safeParse(data);
  if (!parsed.success) {
    throw new ContractValidationError("Invalid TranscriptSegment record", parsed.error.issues);
  }
  return parsed.data;
}

export function parseAiAnalysisRecord(data: unknown) {
  const parsed = aiAnalysisRecordSchema.safeParse(data);
  if (!parsed.success) {
    throw new ContractValidationError("Invalid AIAnalysis record", parsed.error.issues);
  }
  return parsed.data;
}

export function parseAuditEvent(data: unknown) {
  const parsed = auditEventSchema.safeParse(data);
  if (!parsed.success) {
    throw new ContractValidationError("Invalid AuditEvent record", parsed.error.issues);
  }
  return parsed.data;
}

export function safeParseAuditEvent(data: unknown) {
  return auditEventSchema.safeParse(data);
}
