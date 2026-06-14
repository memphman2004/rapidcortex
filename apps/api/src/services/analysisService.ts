import { TranscriptService } from "./transcriptService.js";
import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";
import { runAiAnalysisOrchestrator } from "../ai/aiOrchestrator.js";
import { humanizeApprovedPhraseStrict } from "../ai/phraseHumanizer.js";
import { buildProtocolGuidance } from "rapid-cortex-shared";
import type { AIAnalysis, ProtocolGuidance, UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { getAiRuntimeConfig } from "../ai/aiConfig.js";
import { fingerprintTranscript } from "../ai/transcriptFingerprint.js";
import { AI_ERROR_CODES } from "../ai/aiErrorCodes.js";
import { NormalizedAiError } from "../ai/normalizedAiError.js";
import { logAiMetric } from "../lib/aiMetrics.js";
import { logAiProviderChainResult } from "../lib/aiLog.js";
import { normalizeConfidence } from "../ai/confidence.js";
import { QAService } from "./qaService.js";
import { FieldConfidenceService } from "./fieldConfidenceService.js";
import { env } from "../lib/env.js";
import { buildAnalysisDedupe, buildRetentionFields } from "../lib/retentionPolicy.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";

const transcriptService = new TranscriptService();
const qaService = new QAService();
const fieldConfidenceService = new FieldConfidenceService();
const analysisRepo = new AnalysisRepository();
const agencyRepo = new AgencyRepository();
const incidentRepo = new IncidentRepository();
const auditRepo = new AuditRepository();

export type AnalysisTriggerContext = {
  triggerType: "manual" | "auto";
  requestId?: string;
};

function countAnalysesSince(items: AIAnalysis[], sinceMs: number): number {
  const t = Date.now() - sinceMs;
  let n = 0;
  for (const a of items) {
    const ts = new Date(a.createdAt).getTime();
    if (Number.isFinite(ts) && ts >= t) n += 1;
    if (n > 500) break;
  }
  return n;
}

export class AnalysisService {
  async analyze(
    incidentId: string,
    user: UserContext,
    ctx: AnalysisTriggerContext = { triggerType: "manual" },
  ): Promise<AIAnalysis> {
    const cfg = getAiRuntimeConfig();
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }

    const transcript = await transcriptService.list(incidentId, user);
    const fingerprint = fingerprintTranscript(transcript);
    const segmentCount = transcript.length;

    const prior = await analysisRepo.listByIncident(incidentId);
    const latest = prior[0];

    if (cfg.skipIfTranscriptUnchanged && latest?.analysisStatus !== "failed") {
      if (latest?.transcriptFingerprintAtAnalysis === fingerprint) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ANALYSIS_SKIPPED,
          details: {
            reason: "transcript_unchanged",
            transcriptFingerprint: fingerprint,
            triggerType: ctx.triggerType,
          },
          createdAt: new Date().toISOString(),
          resourceType: "analysis",
          resourceId: incidentId,
        });
        throw new NormalizedAiError({
          code: AI_ERROR_CODES.AI_TRANSCRIPT_UNCHANGED,
          retryable: false,
          httpStatus: 409,
          publicMessage: "Transcript has not changed since the last analysis.",
        });
      }
    }

    if (cfg.analysisDebounceSeconds > 0 && latest?.transcriptFingerprintAtAnalysis === fingerprint) {
      const ageMs = Date.now() - new Date(latest.createdAt).getTime();
      if (ageMs < cfg.analysisDebounceSeconds * 1000) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ANALYSIS_SKIPPED,
          details: {
            reason: "debounce",
            debounceSeconds: cfg.analysisDebounceSeconds,
            triggerType: ctx.triggerType,
          },
          createdAt: new Date().toISOString(),
          resourceType: "analysis",
          resourceId: incidentId,
        });
        throw new NormalizedAiError({
          code: AI_ERROR_CODES.AI_REQUEST_THROTTLED,
          retryable: false,
          httpStatus: 429,
          publicMessage: "Analysis was requested too soon for this incident; please wait.",
        });
      }
    }

    if (cfg.maxAnalyzeRequestsPerIncidentPerHour > 0) {
      const n = countAnalysesSince(prior, 3_600_000);
      if (n >= cfg.maxAnalyzeRequestsPerIncidentPerHour) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ANALYSIS_SKIPPED,
          details: {
            reason: "hourly_cap",
            cap: cfg.maxAnalyzeRequestsPerIncidentPerHour,
            triggerType: ctx.triggerType,
          },
          createdAt: new Date().toISOString(),
          resourceType: "analysis",
          resourceId: incidentId,
        });
        throw new NormalizedAiError({
          code: AI_ERROR_CODES.AI_REQUEST_THROTTLED,
          retryable: false,
          httpStatus: 429,
          publicMessage: "This incident reached the hourly analysis limit.",
        });
      }
    }

    const lockOk = await incidentRepo.tryAcquireAnalysisLock(incidentId, cfg.analysisInFlightLeaseSeconds);
    if (!lockOk) {
      throw new NormalizedAiError({
        code: AI_ERROR_CODES.AI_REQUEST_THROTTLED,
        retryable: true,
        httpStatus: 429,
        publicMessage: "Another analysis is already running for this incident.",
      });
    }

    const input = {
      incidentId,
      agencyId: user.agencyId,
      transcript,
    };

    try {
      const orch = await runAiAnalysisOrchestrator(input, { config: cfg });

      if (!orch.ok) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.ANALYSIS_FAILED,
          details: {
            errorCode: orch.error.code,
            message: orch.error.publicMessage,
            providerAttemptChain: orch.attemptChain,
            triggerType: ctx.triggerType,
            requestId: ctx.requestId,
          },
          createdAt: new Date().toISOString(),
          resourceType: "analysis",
          resourceId: incidentId,
        });
        logAiMetric({
          metric: "analysis_failed",
          errorCode: orch.error.code,
          incidentId,
          agencyId: user.agencyId,
          triggerType: ctx.triggerType,
        });
        throw orch.error;
      }

      const rawGuidance = buildProtocolGuidance(transcript, user.agencyId, "en");
      const protocolGuidance: ProtocolGuidance | undefined = rawGuidance
        ? {
            ...rawGuidance,
            recommendedPhrase: humanizeApprovedPhraseStrict(rawGuidance.recommendedPhrase),
          }
        : undefined;

      const nowIso = new Date().toISOString();
      const meta = cfg.storeProviderMetadata;
      const tenant = await agencyRepo.get(user.agencyId);
      const ret = buildRetentionFields("analysis", {
        agencyConfig: tenant?.config,
        anchorIso: nowIso,
        policyId: env.defaultRetentionPolicyId,
        dedupe: buildAnalysisDedupe(incidentId, nowIso),
        envDefaults: env,
      });

      const analysis: AIAnalysis = {
        analysisId: makeId("analysis"),
        incidentId,
        agencyId: user.agencyId,
        category: orch.output.category,
        urgency: orch.output.urgency,
        confidence: normalizeConfidence(orch.output.confidence),
        nextQuestion: orch.output.nextQuestion,
        recommendedAction: orch.output.recommendedAction,
        summary: orch.output.summary,
        rationale: orch.output.rationale,
        escalationFlag: orch.output.escalationFlag,
        provider: orch.winner.adapterName,
        createdAt: nowIso,
        ...(protocolGuidance !== undefined ? { protocolGuidance } : {}),
        ...(meta
          ? {
              providerUsed: orch.winner.adapterName,
              modelUsed: orch.winner.model,
              promptVersion: cfg.promptVersion,
              analysisLatencyMs: orch.totalLatencyMs,
              fallbackCount: orch.fallbackCount,
              providerAttemptChain: orch.attemptChain,
              analysisStatus: "success" as const,
              analyzedAt: nowIso,
              transcriptSegmentCountAtAnalysis: segmentCount,
              transcriptFingerprintAtAnalysis: fingerprint,
              triggerType: ctx.triggerType,
              triggeredByUserId: ctx.triggerType === "manual" ? user.userId : undefined,
            }
          : {
              analysisStatus: "success" as const,
              analyzedAt: nowIso,
              transcriptSegmentCountAtAnalysis: segmentCount,
              transcriptFingerprintAtAnalysis: fingerprint,
              triggerType: ctx.triggerType,
              triggeredByUserId: ctx.triggerType === "manual" ? user.userId : undefined,
            }),
        ...ret,
      };

      await analysisRepo.create(analysis);

      await incidentRepo.updateAnalysisFields(incidentId, {
        category: analysis.category,
        urgency: analysis.urgency,
        confidence: analysis.confidence,
        summary: analysis.summary,
        escalationFlag: analysis.escalationFlag,
        updatedAt: nowIso,
      });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.ANALYSIS_CREATED,
        details: {
          analysisId: analysis.analysisId,
          provider: analysis.provider,
          modelUsed: analysis.modelUsed ?? orch.winner.model,
          fallbackCount: orch.fallbackCount,
          usedFallback: orch.fallbackCount > 0,
          analysisLatencyMs: orch.totalLatencyMs,
          promptVersion: cfg.promptVersion,
          triggerType: ctx.triggerType,
          success: true,
          requestId: ctx.requestId,
        },
        createdAt: nowIso,
        resourceType: "analysis",
        resourceId: analysis.analysisId,
      });

      await incidentTimelineLogger.emit({
        incidentId,
        agencyId: user.agencyId,
        kind: "ai_analysis_created",
        source: "ai",
        actorId: user.userId,
        actorRole: user.role,
        payload: {
          analysisId: analysis.analysisId,
          category: analysis.category,
          urgency: analysis.urgency,
          triggerType: ctx.triggerType,
        },
        timestamp: nowIso,
      });

      logAiProviderChainResult({
        winner: orch.winner.adapterName,
        tierIndex: orch.fallbackCount,
        usedFallback: orch.fallbackCount > 0,
        usedSecondaryFallback: orch.fallbackCount > 1,
        incidentId,
        model: orch.winner.model,
        latencyMs: orch.totalLatencyMs,
      });

      logAiMetric({
        metric: "analysis_succeeded",
        value: orch.totalLatencyMs,
        incidentId,
        agencyId: user.agencyId,
        triggerType: ctx.triggerType,
      });

      await qaService.runPendingScoringAfterAnalysis(user, user.agencyId, incidentId);

      if (env.enableFieldConfidence) {
        try {
          await fieldConfidenceService.scoreAndPersist(incidentId, user, transcript, segmentCount);
        } catch (err) {
          console.error(
            JSON.stringify({
              type: "analysis.field_confidence_failed",
              incidentId,
              message: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }

      return analysis;
    } finally {
      await incidentRepo.releaseAnalysisLock(incidentId);
    }
  }

  async list(incidentId: string, user: UserContext) {
    const resolved = await resolveIncidentRead(incidentId, user);
    if (!resolved) {
      throw new Error("FORBIDDEN");
    }
    return analysisRepo.listByIncident(incidentId);
  }
}
