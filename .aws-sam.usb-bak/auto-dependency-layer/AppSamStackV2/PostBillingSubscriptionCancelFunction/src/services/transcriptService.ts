import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { makeId } from "../lib/ids.js";
import { env } from "../lib/env.js";
import { buildRetentionFields, buildTranscriptDedupe } from "../lib/retentionPolicy.js";
import type { TranscriptChunkInput, TranscriptSegment, UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { resolveEnglishTranscriptFromChunk } from "../voice/transcriptEnglishPipeline.js";
import { logVoiceMetric } from "../voice/voiceMetrics.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";

const transcriptRepo = new TranscriptRepository();
const incidentRepo = new IncidentRepository();
const auditRepo = new AuditRepository();
const agencyRepo = new AgencyRepository();

export class TranscriptService {
  async add(incidentId: string, payload: TranscriptChunkInput, user: UserContext): Promise<TranscriptSegment> {
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }

    const list = await transcriptRepo.listByIncident(incidentId);
    const segmentIndex = list.length;

    const pipeline = await resolveEnglishTranscriptFromChunk(payload, { agencyId: user.agencyId });
    const englishText = pipeline.englishText.trim();
    if (!englishText) {
      throw new Error("EMPTY_ENGLISH_TRANSCRIPT");
    }

    const nowIso = new Date().toISOString();
    const ts = payload.timestamp ?? nowIso;
    const tenant = await agencyRepo.get(user.agencyId);
    const ret = buildRetentionFields("transcript", {
      agencyConfig: tenant?.config,
      anchorIso: ts,
      policyId: env.defaultRetentionPolicyId,
      dedupe: buildTranscriptDedupe(incidentId, ts),
      envDefaults: env,
    });
    const segment: TranscriptSegment = {
      segmentId: makeId("seg"),
      incidentId,
      agencyId: user.agencyId,
      speaker: payload.speaker,
      text: englishText,
      timestamp: ts,
      segmentIndex,
      callSessionId: payload.callSessionId,
      originalLanguage: pipeline.originalLanguage ?? payload.originalLanguage,
      detectedLanguage: payload.detectedLanguage ?? pipeline.originalLanguage,
      languageAlternatives: pipeline.languageAlternatives ?? payload.languageAlternatives,
      languageConfidence: pipeline.languageConfidence,
      originalTranscript: pipeline.originalTranscript ?? payload.originalTranscript?.trim(),
      originalTranscriptConfidence: payload.originalTranscriptConfidence ?? payload.transcriptConfidence,
      translatedEnglishTranscript: englishText,
      translationConfidence: pipeline.translationConfidence,
      translationProviderUsed: pipeline.translationProviderUsed,
      translationModelUsed: pipeline.translationModelUsed ?? payload.translationModelUsed,
      sttProviderUsed: payload.sttProviderUsed,
      sttProviderRequestId: payload.sttProviderRequestId,
      sttModelUsed: payload.sttModelUsed,
      transcriptConfidence: payload.transcriptConfidence,
      isPartial: payload.isPartial,
      isFinal: payload.isFinal ?? true,
      needsInterpreterReview: pipeline.needsInterpreterReview,
      lowConfidence: pipeline.lowConfidence,
      chunkSource: payload.chunkSource ?? "manual",
      startTimeMs: payload.startTimeMs,
      endTimeMs: payload.endTimeMs,
      sttLatencyMs: payload.sttLatencyMs,
      translationLatencyMs: pipeline.translationLatencyMs ?? payload.translationLatencyMs,
      sttFallbackUsed: payload.sttFallbackUsed,
      translationFallbackUsed: pipeline.translationFallbackUsed,
      updatedAt: nowIso,
      ...ret,
    };

    await transcriptRepo.add(segment);

    const auditDetails: Record<string, unknown> = {
      segmentId: segment.segmentId,
      speaker: segment.speaker,
      originalLanguage: segment.originalLanguage,
      languageConfidence: pipeline.languageConfidence,
      detectionMethod: pipeline.detectionMethod,
      needsInterpreterReview: segment.needsInterpreterReview,
      lowConfidence: segment.lowConfidence,
    };
    if (pipeline.originalTranscript && pipeline.originalLanguage && pipeline.originalLanguage !== "en") {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VOICE_TRANSLATION_APPLIED,
        details: {
          segmentId: segment.segmentId,
          sourceLanguage: pipeline.originalLanguage,
          translationProvider: pipeline.translationProviderUsed,
          translationModel: pipeline.translationModelUsed,
          translationFallbackUsed: pipeline.translationFallbackUsed,
        },
        createdAt: nowIso,
        resourceType: "transcript",
        resourceId: segment.segmentId,
      });
      logVoiceMetric({
        metric: "voice_translation_applied",
        incidentId,
        agencyId: user.agencyId,
        sourceLanguage: pipeline.originalLanguage,
      });
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.TRANSCRIPT_APPEND,
      details: auditDetails,
      createdAt: nowIso,
      resourceType: "transcript",
      resourceId: segment.segmentId,
    });

    if (segmentIndex === 0) {
      await incidentTimelineLogger.emit({
        incidentId,
        agencyId: user.agencyId,
        kind: "transcription_started",
        source: "dispatcher",
        actorId: user.userId,
        actorRole: user.role,
        payload: { segmentId: segment.segmentId, speaker: segment.speaker },
        timestamp: nowIso,
      });
    }

    return segment;
  }

  async list(incidentId: string, user: UserContext) {
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) {
      throw new Error("FORBIDDEN");
    }
    return transcriptRepo.listByIncident(incidentId);
  }
}
