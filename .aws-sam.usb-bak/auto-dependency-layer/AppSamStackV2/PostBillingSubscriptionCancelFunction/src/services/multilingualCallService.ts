import { TranscriptService } from "./transcriptService.js";
import { LanguageSessionRepository } from "../repositories/languageSessionRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";
import type {
  LanguageCallSession,
  MultilingualProviderMode,
  PostCallAudioChunkBody,
  StartLanguageSessionBody,
  TranscriptSegment,
  UserContext,
} from "rapid-cortex-shared";
import type { SttChunkResult } from "../voice/interfaces.js";
import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { getMultilingualVoiceConfig } from "../voice/multilingualConfig.js";
import { buildSttProviderChain } from "../voice/stt/sttProviderFactory.js";
import { runSttChain } from "../voice/stt/sttOrchestrator.js";
import { buildLanguageDetectorChain } from "../voice/languageDetection/languageDetectorFactory.js";
import { runLanguageDetectionChain } from "../voice/languageDetection/languageDetectionOrchestrator.js";
import { logVoiceMetric } from "../voice/voiceMetrics.js";
import { VoiceProviderError } from "../voice/providerErrors.js";
import { AnalysisService } from "./analysisService.js";
import { env } from "../lib/env.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import {
  resolveLanguageProviderMode,
  resolveTextTranslationBackend,
} from "./language/languageProviderFactory.js";
import { azureTranslatorTranslateText } from "./language/azureTranslatorText.js";

export type ProcessAudioChunkResult = {
  outcome: "created" | "replayed";
  segment: TranscriptSegment;
  sttProvider: string;
  languageCode: string;
  sttFallbackUsed: boolean;
  sttLatencyMs: number;
  lowConfidence: boolean;
  needsInterpreterReview?: boolean;
};

const sessions = new LanguageSessionRepository();
const incidents = new IncidentRepository();
const audit = new AuditRepository();
const transcripts = new TranscriptService();
const transcriptRepo = new TranscriptRepository();
const analysisService = new AnalysisService();

export class MultilingualCallService {
  async startSession(
    incidentId: string,
    user: UserContext,
    body: StartLanguageSessionBody,
  ): Promise<LanguageCallSession> {
    const incident = await incidents.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) throw new Error("FORBIDDEN");

    const now = new Date().toISOString();
    const sessionId = makeId("lgs");
    const hint = body.preferredLanguageHint?.split("-")[0]?.toLowerCase();
    const vcfg = getMultilingualVoiceConfig();
    const mode: MultilingualProviderMode = resolveLanguageProviderMode(vcfg);
    const textBackend = resolveTextTranslationBackend(vcfg);
    const session: LanguageCallSession = {
      sessionId,
      incidentId,
      agencyId: user.agencyId,
      createdAt: now,
      updatedAt: now,
      status: "active",
      segmentCount: 0,
      multilingualProviderMode: mode,
      textTranslationBackend: textBackend,
      ...(hint
        ? {
            detectedLanguage: hint,
            languageConfidence: 0.5,
            detectionMethod: "client_hint",
            detectionTimestamp: now,
          }
        : {}),
    };

    await sessions.put(session);

    await audit.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VOICE_SESSION_STARTED,
      details: { sessionId, preferredLanguageHint: body.preferredLanguageHint },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });

    logVoiceMetric({ metric: "voice_session_started", sessionId, incidentId });
    return (await sessions.get(sessionId))!;
  }

  async finalizeSession(incidentId: string, user: UserContext, sessionId: string): Promise<void> {
    const incident = await incidents.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) throw new Error("FORBIDDEN");
    const s = await sessions.get(sessionId);
    if (!s || s.incidentId !== incidentId) throw new Error("SESSION_NOT_FOUND");
    const now = new Date().toISOString();
    await sessions.patch(sessionId, { status: "finalized", updatedAt: now });
    await audit.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VOICE_SESSION_FINALIZED,
      details: { sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
  }

  async getStatus(incidentId: string, user: UserContext): Promise<{
    sessions: LanguageCallSession[];
    latest?: LanguageCallSession;
    languageProvider: MultilingualProviderMode;
    textTranslationBackend: "aws" | "google";
  }> {
    const incident = await incidents.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) throw new Error("FORBIDDEN");
    const list = await sessions.listByIncident(incidentId);
    const vcfg = getMultilingualVoiceConfig();
    return {
      sessions: list,
      latest: list[0],
      languageProvider: resolveLanguageProviderMode(vcfg),
      textTranslationBackend: resolveTextTranslationBackend(vcfg),
    };
  }

  /**
   * Standalone Azure Translator text translation for a language session. Required by
   * `workspace.translation` permission; the handler asserts the permission, this method
   * enforces agencyId scoping + emits the audit event.
   *
   * Optional `sourceLanguage` allows callers (silent-text, transcript viewers) to skip
   * autodetect when they already know the source locale; otherwise we pass `auto`.
   */
  async translateText(
    incidentId: string,
    user: UserContext,
    body: { text: string; targetLanguage: string; sourceLanguage?: string; sessionId?: string },
  ): Promise<{
    translatedText: string;
    provider: "azure-translator";
    detectedLanguage: string;
    sourceLanguage: string;
    targetLanguage: string;
  }> {
    const incident = await incidents.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) throw new Error("FORBIDDEN");

    if (body.sessionId) {
      const session = await sessions.get(body.sessionId);
      if (!session || session.incidentId !== incidentId || session.agencyId !== user.agencyId) {
        throw new Error("SESSION_NOT_FOUND");
      }
    }

    const vcfg = getMultilingualVoiceConfig();
    const from = body.sourceLanguage?.trim() || "auto";
    const to = body.targetLanguage.trim();

    const { translatedText } = await azureTranslatorTranslateText({
      cfg: vcfg,
      text: body.text,
      from,
      to,
      agencyId: user.agencyId,
    });

    const detectedLanguage = from === "auto" ? "" : from;

    await audit.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VOICE_TRANSLATION_APPLIED,
      details: {
        sessionId: body.sessionId,
        provider: "azure-translator",
        from,
        to,
        chars: body.text.length,
      },
      createdAt: new Date().toISOString(),
      resourceType: "session",
      resourceId: body.sessionId ?? incidentId,
    });

    return {
      translatedText,
      provider: "azure-translator",
      detectedLanguage,
      sourceLanguage: from,
      targetLanguage: to,
    };
  }

  async processAudioChunk(
    incidentId: string,
    user: UserContext,
    body: PostCallAudioChunkBody,
  ): Promise<ProcessAudioChunkResult> {
    const incident = await incidents.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) throw new Error("FORBIDDEN");
    const session = await sessions.get(body.sessionId);
    if (!session || session.incidentId !== incidentId || session.status !== "active") {
      throw new Error("SESSION_NOT_FOUND");
    }

    /** Idempotent replay: same sequence already produced a segment (network retry safe). */
    if (
      session.lastChunkSequence === body.sequence &&
      session.lastChunkSegmentId &&
      session.lastChunkSequence != null
    ) {
      const existing = await transcriptRepo.findSegmentById(incidentId, session.lastChunkSegmentId);
      if (existing) {
        const cfg = getMultilingualVoiceConfig();
        return {
          outcome: "replayed",
          segment: existing,
          sttProvider: existing.sttProviderUsed ?? "unknown",
          languageCode: existing.detectedLanguage ?? existing.originalLanguage ?? "und",
          sttFallbackUsed: Boolean(existing.sttFallbackUsed),
          sttLatencyMs: existing.sttLatencyMs ?? 0,
          lowConfidence: Boolean(existing.lowConfidence),
          needsInterpreterReview: existing.needsInterpreterReview,
        };
      }
    }

    const okSeq = await sessions.tryAdvanceChunkSequence(body.sessionId, body.sequence);
    if (!okSeq) {
      const err = new Error("DUPLICATE_OR_OUT_OF_ORDER_CHUNK");
      (err as Error & { code?: string }).code = "DUPLICATE_OR_OUT_OF_ORDER_CHUNK";
      throw err;
    }

    const raw = Buffer.from(body.audioBase64, "base64");
    const cfg = getMultilingualVoiceConfig();
    const sttProviders = buildSttProviderChain(cfg);
    const hint = session.detectedLanguage;
    const sttStarted = Date.now();
    let stt: SttChunkResult;
    let sttProvider: string;
    let sttTier = 0;
    try {
      const out = await runSttChain(
        sttProviders,
        { audioBytes: new Uint8Array(raw), format: body.format, hintLanguage: hint },
        {
          agencyId: user.agencyId,
          requestTimeoutMs: cfg.providerRequestTimeoutMs,
          maxRetries: cfg.providerMaxRetries,
          enableFallbacks: cfg.providerEnableFallbacks,
        },
      );
      stt = out.result;
      sttProvider = out.providerName;
      sttTier = out.tierIndex;
    } catch (e) {
      const code = e instanceof VoiceProviderError ? e.code : "UNKNOWN_PROVIDER_ERROR";
      const nowIso = new Date().toISOString();
      await sessions.patch(body.sessionId, { lastErrorCode: code });
      await audit.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VOICE_PIPELINE_FAILED,
        details: {
          sessionId: body.sessionId,
          sequence: body.sequence,
          phase: "stt",
          code,
        },
        createdAt: nowIso,
        resourceType: "session",
        resourceId: body.sessionId,
      });
      logVoiceMetric({ metric: "voice_pipeline_failed", phase: "stt", code, incidentId });
      throw e;
    }
    const sttLatencyMs = Date.now() - sttStarted;
    if (sttTier > 0) {
      logVoiceMetric({ metric: "stt_provider_fallback", tier: sttTier, provider: sttProvider, incidentId });
    }

    if (stt.confidence < cfg.sttMinConfidence) {
      await sessions.patch(body.sessionId, {
        needsInterpreterReview: true,
      });
    }

    if (!session.detectedLanguage && stt.transcript.trim()) {
      const detectors = buildLanguageDetectorChain(cfg);
      const lid = await runLanguageDetectionChain(detectors, stt.transcript, {
        requestTimeoutMs: Math.min(cfg.providerRequestTimeoutMs, 25_000),
        maxRetries: cfg.providerMaxRetries,
      });
      const lang = normalizeCallLanguageCode(lid.language);
      const now = new Date().toISOString();
      const langLow = lid.confidence < cfg.languageDetectionMinConfidence || lang === "und";
      await sessions.patch(body.sessionId, {
        detectedLanguage: lang,
        languageConfidence: lid.confidence,
        detectionMethod: lid.detectionMethod,
        detectionTimestamp: now,
        ...(langLow ? { needsInterpreterReview: true } : {}),
      });
      await audit.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VOICE_LANGUAGE_DETECTED,
        details: {
          sessionId: body.sessionId,
          language: lang,
          confidence: lid.confidence,
          method: lid.detectionMethod,
        },
        createdAt: now,
        resourceType: "session",
        resourceId: body.sessionId,
      });
    }

    const sttModels = [cfg.sttModelPrimary, cfg.sttModelSecondary, cfg.sttModelTertiary];
    const segment = await transcripts.add(
      incidentId,
      {
        speaker: body.speaker ?? "caller",
        originalTranscript: stt.transcript,
        originalLanguage: stt.languageCode,
        detectedLanguage: normalizeCallLanguageCode(stt.languageCode),
        callSessionId: body.sessionId,
        chunkSource: "voice_upload",
        isPartial: stt.isPartial,
        isFinal: !stt.isPartial,
        startTimeMs: stt.startTimeMs ?? 0,
        endTimeMs: stt.endTimeMs ?? body.durationMs,
        transcriptConfidence: stt.confidence,
        originalTranscriptConfidence: stt.confidence,
        sttProviderUsed: sttProvider,
        sttProviderRequestId: stt.providerRequestId,
        sttModelUsed: stt.sttModelUsed ?? sttModels[sttTier] ?? cfg.sttModelPrimary,
        sttLatencyMs,
        sttFallbackUsed: sttTier > 0,
      },
      user,
    );

    await audit.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VOICE_AUDIO_CHUNK_PROCESSED,
      details: {
        sessionId: body.sessionId,
        sequence: body.sequence,
        sttProvider: sttProvider,
        language: stt.languageCode,
        segmentId: segment.segmentId,
      },
      createdAt: new Date().toISOString(),
      resourceType: "transcript",
      resourceId: segment.segmentId,
    });

    await sessions.patch(body.sessionId, { lastChunkSegmentId: segment.segmentId });

    const n = env.autoAnalyzeEveryNSegments;
    const cfgVoice = getMultilingualVoiceConfig();
    if (
      cfgVoice.autoFeedTranslatedTranscriptsToAnalysis &&
      n > 0 &&
      !stt.isPartial &&
      segment.isFinal !== false
    ) {
      const list = await transcriptRepo.listByIncident(incidentId);
      if (list.length > 0 && list.length % n === 0) {
        try {
          await analysisService.analyze(incidentId, user, { triggerType: "auto" });
        } catch {
          /* best-effort */
        }
      }
    }

    return {
      outcome: "created",
      segment,
      sttProvider,
      languageCode: stt.languageCode,
      sttFallbackUsed: sttTier > 0,
      sttLatencyMs,
      lowConfidence: stt.confidence < cfg.sttMinConfidence,
      needsInterpreterReview: segment.needsInterpreterReview,
    };
  }
}
