import type {
  AIAnalysis,
  TriageAiClassification,
  TriageAnalyzeEvent,
  TriageClassification,
  TriageResult,
  TranscriptSegment,
  UserContext,
} from "rapid-cortex-shared";
import { triageResultSchema } from "rapid-cortex-shared";
import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { buildAnalysisDedupe, buildRetentionFields } from "../lib/retentionPolicy.js";
import { classifyTranscript } from "../lib/triage/classifier.js";
import { enqueueQueueItem } from "../lib/triage/queue-store.js";

const analysisRepo = new AnalysisRepository();
const agencyRepo = new AgencyRepository();
const incidentRepo = new IncidentRepository();
const transcriptRepo = new TranscriptRepository();
const auditRepo = new AuditRepository();

function normalize(s: string): string {
  return s.toLowerCase();
}

function inferTriage(segments: TranscriptSegment[]): TriageResult {
  const text = normalize(segments.map((x) => x.text).join(" \n "));
  if (env.triageMock) {
    return triageResultSchema.parse({
      bucket: "scheduled_callback",
      confidence: 0.78,
      headline: "Mock triage — scheduled callback",
      reasoning: "Triage mock mode is enabled for this deployment.",
      tags: ["mock"],
    });
  }
  if (/\b(fire|smoke|burning|trapped|can't breathe|cant breathe|not breathing)\b/.test(text)) {
    return triageResultSchema.parse({
      bucket: "escalate_voice",
      confidence: 0.88,
      headline: "Safety-critical language detected",
      reasoning: "Transcript contains high-acuity cues; keep caller on the line and follow agency escalation policy.",
      tags: ["safety_language"],
    });
  }
  if (/\b(lost cat|noise complaint|parking|trash pickup|office hours|callback later)\b/.test(text)) {
    return triageResultSchema.parse({
      bucket: "routine_service",
      confidence: 0.72,
      headline: "Routine municipal / informational",
      reasoning: "Language aligns with non-emergency municipal or informational topics.",
      tags: ["routine"],
    });
  }
  if (/\b(thanks|nevermind|wrong number|all set|goodbye)\b/.test(text)) {
    return triageResultSchema.parse({
      bucket: "self_resolved",
      confidence: 0.65,
      headline: "Caller may be self-resolving",
      reasoning: "Closing language suggests the caller may no longer need dispatch assistance.",
      tags: ["closure_language"],
    });
  }
  return triageResultSchema.parse({
    bucket: "information_only",
    confidence: 0.55,
    headline: "General information triage",
    reasoning: "No strong non-emergency or emergency pattern matched; treat as informational until more context arrives.",
    tags: ["default"],
  });
}

function mapClassificationToBucket(classification: TriageClassification): TriageResult["bucket"] {
  switch (classification) {
    case "NON_EMERGENCY":
      return "routine_service";
    case "UNCERTAIN":
    case "EMERGENCY":
    default:
      return "escalate_voice";
  }
}

function mapAiToTriageResult(ai: TriageAiClassification): TriageResult {
  const bucket = mapClassificationToBucket(ai.classification);
  const headline =
    ai.classification === "NON_EMERGENCY"
      ? `Non-emergency — ${ai.suggestedCategory}`
      : ai.classification === "UNCERTAIN"
        ? "Uncertain — treat as emergency"
        : "Emergency classification";

  return triageResultSchema.parse({
    bucket,
    confidence: ai.confidence / 100,
    headline,
    reasoning: ai.reasoning,
    tags: [ai.classification.toLowerCase(), ai.suggestedPriority.toLowerCase()],
    classification: ai.classification,
    suggestedCategory: ai.suggestedCategory,
    suggestedPriority: ai.suggestedPriority,
  });
}

function mapBucketToAnalysisFields(bucket: TriageResult["bucket"]): Pick<
  AIAnalysis,
  "category" | "urgency" | "nextQuestion" | "recommendedAction" | "summary" | "rationale" | "escalationFlag"
> {
  switch (bucket) {
    case "escalate_voice":
      return {
        category: "police",
        urgency: "high",
        nextQuestion: "Non-emergency triage — escalate to voice",
        recommendedAction: "Route to voice channel or on-duty lead per agency policy.",
        summary: "Triage recommends escalation to live voice handling.",
        rationale: "Structured triage output is attached on this analysis row.",
        escalationFlag: true,
      };
    case "routine_service":
      return {
        category: "welfare_check",
        urgency: "low",
        nextQuestion: "Non-emergency triage — routine service",
        recommendedAction: "Handle as routine municipal / non-emergency service.",
        summary: "Triage: routine service path.",
        rationale: "Structured triage output is attached on this analysis row.",
        escalationFlag: false,
      };
    case "scheduled_callback":
      return {
        category: "unknown",
        urgency: "low",
        nextQuestion: "Non-emergency triage — scheduled callback",
        recommendedAction: "Offer callback window or transfer to appropriate desk.",
        summary: "Triage: scheduled callback disposition.",
        rationale: "Structured triage output is attached on this analysis row.",
        escalationFlag: false,
      };
    case "information_only":
      return {
        category: "unknown",
        urgency: "low",
        nextQuestion: "Non-emergency triage — informational",
        recommendedAction: "Provide approved informational scripts only.",
        summary: "Triage: informational handling.",
        rationale: "Structured triage output is attached on this analysis row.",
        escalationFlag: false,
      };
    case "self_resolved":
      return {
        category: "welfare_check",
        urgency: "low",
        nextQuestion: "Non-emergency triage — self-resolved",
        recommendedAction: "Confirm closure and document outcome.",
        summary: "Triage: caller appears to be resolving without dispatch.",
        rationale: "Structured triage output is attached on this analysis row.",
        escalationFlag: false,
      };
    default:
      return {
        category: "unknown",
        urgency: "moderate",
        nextQuestion: "Non-emergency triage",
        recommendedAction: "Review triage panel for recommended handling.",
        summary: "Triage snapshot recorded.",
        rationale: "Structured triage output is attached on this analysis row.",
        escalationFlag: false,
      };
  }
}

function segmentsToAnalyzeEvent(
  agencyId: string,
  incidentId: string,
  agencyName: string,
  segments: TranscriptSegment[],
  triageConfig: { enabled: boolean; nonEmergencyQueueEnabled?: boolean },
): TriageAnalyzeEvent {
  return {
    agencyId,
    incidentId,
    agencyName,
    segments: segments.map((s, i) => ({
      speaker: s.speaker ?? "unknown",
      text: s.text,
      startMs: (s.segmentIndex ?? i) * 1000,
    })),
    agencyTriageConfig: {
      enabled: triageConfig.enabled,
      nonEmergencyQueueEnabled: triageConfig.nonEmergencyQueueEnabled ?? false,
    },
  };
}

export class TriageService {
  async getLatest(incidentId: string, user: UserContext): Promise<TriageResult | null> {
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }
    const rows = await analysisRepo.listByIncident(incidentId);
    const triageRows = rows.filter((r) => r.analysisRecordKind === "triage" && r.nonEmergencyTriage);
    return triageRows[0]?.nonEmergencyTriage ?? null;
  }

  async runAutoIfNeeded(incidentId: string, user: UserContext, segmentCount: number): Promise<void> {
    if (!env.enableNonEmergencyTriage) return;
    const n = env.triageDetectEveryNSegments;
    if (n <= 0 || segmentCount % n !== 0) return;

    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) return;

    const tenant = await agencyRepo.get(user.agencyId);
    if (!tenant?.config.triage?.enabled) return;

    const segments = await transcriptRepo.listByIncident(incidentId);
    let triage: TriageResult;
    let aiMeta: TriageAiClassification | null = null;

    try {
      const event = segmentsToAnalyzeEvent(
        user.agencyId,
        incidentId,
        tenant.name ?? user.agencyId,
        segments,
        tenant.config.triage,
      );
      aiMeta = await classifyTranscript(event);
      triage = mapAiToTriageResult(aiMeta);
    } catch (err) {
      console.error(
        JSON.stringify({
          type: "triage.classifier_failed",
          incidentId,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      triage = inferTriage(segments);
    }

    await this.persist(incidentId, user, triage, aiMeta);

    if (
      aiMeta?.classification === "NON_EMERGENCY" &&
      tenant.config.triage?.nonEmergencyQueueEnabled &&
      env.nonEmergencyQueueTable
    ) {
      try {
        const now = aiMeta.processedAt;
        const transcriptSummary = segments
          .map((s) => s.text)
          .join(" ")
          .slice(0, 300);
        const retentionDays = Number.parseInt(env.transcriptRetentionPolicyDays || "0", 10) || 0;
        const ttl =
          retentionDays > 0
            ? Math.floor(Date.now() / 1000) + retentionDays * 86_400
            : undefined;

        await enqueueQueueItem({
          agencyId: user.agencyId,
          sk: `${now}#${incidentId}`,
          incidentId,
          classification: aiMeta.classification,
          confidence: aiMeta.confidence,
          reasoning: aiMeta.reasoning,
          suggestedCategory: aiMeta.suggestedCategory,
          suggestedPriority: aiMeta.suggestedPriority,
          transcriptSummary,
          queuedAt: now,
          ttl,
        });
      } catch (enqueueErr) {
        console.error(
          JSON.stringify({
            type: "triage.enqueue_failed",
            incidentId,
            message: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
          }),
        );
      }
    }
  }

  async persist(
    incidentId: string,
    user: UserContext,
    triage: TriageResult,
    aiMeta?: TriageAiClassification | null,
  ): Promise<AIAnalysis> {
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }
    const mapped = mapBucketToAnalysisFields(triage.bucket);
    const now = new Date().toISOString();
    const tenant = await agencyRepo.get(user.agencyId);
    const ret = buildRetentionFields("analysis", {
      agencyConfig: tenant?.config,
      anchorIso: now,
      policyId: env.defaultRetentionPolicyId,
      dedupe: buildAnalysisDedupe(incidentId, now),
      envDefaults: env,
    });
    const row: AIAnalysis = {
      analysisId: makeId("triage"),
      incidentId,
      agencyId: user.agencyId,
      analysisRecordKind: "triage",
      nonEmergencyTriage: triage,
      category: mapped.category,
      urgency: mapped.urgency,
      confidence: triage.confidence,
      nextQuestion: mapped.nextQuestion,
      recommendedAction: mapped.recommendedAction,
      summary: triage.headline,
      rationale: triage.reasoning,
      escalationFlag: mapped.escalationFlag,
      provider: aiMeta?.mock ? "triage-mock-v1" : aiMeta ? "triage-bedrock-v1" : "triage-heuristic-v1",
      createdAt: now,
      triggerType: "auto",
      triggeredByUserId: user.userId,
      analysisStatus: "success",
      ...ret,
    };
    await analysisRepo.create(row);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: aiMeta ? AUDIT_EVENT_TYPES.TRIAGE_CLASSIFIED : AUDIT_EVENT_TYPES.TRIAGE_RECORDED,
      details: {
        analysisId: row.analysisId,
        bucket: triage.bucket,
        classification: triage.classification ?? null,
        confidence: aiMeta?.confidence ?? Math.round(triage.confidence * 100),
        mock: aiMeta?.mock ?? false,
        segmentCount: aiMeta?.segmentCount ?? null,
      },
      createdAt: now,
      resourceType: "analysis",
      resourceId: row.analysisId,
    });
    return row;
  }

  async override(
    incidentId: string,
    user: UserContext,
    bucket: TriageResult["bucket"],
    reason?: string,
  ): Promise<TriageResult> {
    const current = await this.getLatest(incidentId, user);
    if (!current) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const next: TriageResult = {
      ...current,
      bucket,
      confidence: Math.max(current.confidence, 0.9),
      overriddenAt: new Date().toISOString(),
      overriddenByUserId: user.userId,
      reasoning: reason ? `${current.reasoning}\n\nOverride: ${reason}` : current.reasoning,
    };
    await this.persist(incidentId, user, next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.TRIAGE_OVERRIDDEN,
      details: { bucket },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });
    return next;
  }
}
