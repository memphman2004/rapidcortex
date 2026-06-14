import type { AIAnalysis, ConfidenceAnalysis, TranscriptSegment, UserContext } from "rapid-cortex-shared";
import { AnalysisRepository } from "../repositories/analysisRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "../lib/ids.js";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { buildAnalysisDedupe, buildRetentionFields } from "../lib/retentionPolicy.js";
import { scoreConfidence } from "../lib/confidence/scorer.js";

const analysisRepo = new AnalysisRepository();
const agencyRepo = new AgencyRepository();
const incidentRepo = new IncidentRepository();
const transcriptRepo = new TranscriptRepository();
const auditRepo = new AuditRepository();

function transcriptToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${s.speaker}]: ${s.text}`).join("\n");
}

export class FieldConfidenceService {
  async getLatest(incidentId: string, user: UserContext): Promise<ConfidenceAnalysis | null> {
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }
    const rows = await analysisRepo.listByIncident(incidentId);
    const fcRows = rows.filter(
      (r) => r.analysisRecordKind === "field_confidence" && r.fieldConfidenceAnalysis,
    );
    return fcRows[0]?.fieldConfidenceAnalysis ?? null;
  }

  async runAutoIfNeeded(incidentId: string, user: UserContext, segmentCount: number): Promise<void> {
    if (!env.enableFieldConfidence) return;
    const n = env.confidenceScoreEveryNSegments;
    if (n <= 0 || segmentCount % n !== 0) return;

    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) return;

    const segments = await transcriptRepo.listByIncident(incidentId);
    if (segments.length === 0) return;

    await this.scoreAndPersist(incidentId, user, segments, segmentCount);
  }

  async scoreAndPersist(
    incidentId: string,
    user: UserContext,
    segments: TranscriptSegment[],
    segmentCount: number,
  ): Promise<AIAnalysis> {
    const incident = await incidentRepo.get(incidentId);
    if (!incident || incident.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }

    const priorRows = await analysisRepo.listByIncident(incidentId);
    const priorFc = priorRows.find(
      (r) => r.analysisRecordKind === "field_confidence" && r.fieldConfidenceAnalysis,
    );
    const previous = priorFc?.fieldConfidenceAnalysis;
    const version = (previous?.version ?? 0) + 1;

    const { analysis: fieldConfidenceAnalysis, groundingFlags } = await scoreConfidence(
      incidentId,
      user.agencyId,
      transcriptToText(segments),
      segmentCount,
      version,
      previous ?? undefined,
    );

    const now = new Date().toISOString();
    const tenant = await agencyRepo.get(user.agencyId);
    const ret = buildRetentionFields("analysis", {
      agencyConfig: tenant?.config,
      anchorIso: now,
      policyId: env.defaultRetentionPolicyId,
      dedupe: buildAnalysisDedupe(incidentId, now),
      envDefaults: env,
    });

    const agg = fieldConfidenceAnalysis.aggregate;
    const row: AIAnalysis = {
      analysisId: makeId("fc"),
      incidentId,
      agencyId: user.agencyId,
      analysisRecordKind: "field_confidence",
      fieldConfidenceAnalysis,
      category: "unknown",
      urgency: agg.criticalGaps > 0 ? "high" : "moderate",
      confidence: agg.overallScore / 100,
      nextQuestion:
        agg.topSuggestedQuestion ??
        "Review per-field confidence and ask follow-up questions where gaps remain.",
      recommendedAction: `Incident picture: ${agg.pictureStatus}. Focus on ${agg.attentionRequired.slice(0, 3).join(", ") || "captured fields"}.`,
      summary: `Field confidence v${version} — ${agg.overallScore}% overall (${agg.pictureStatus}).`,
      rationale: agg.hasConflicts
        ? "Conflicting caller statements detected on one or more fields."
        : `${agg.criticalGaps} critical field gap(s) remain.`,
      escalationFlag: agg.criticalGaps > 0 || agg.hasConflicts,
      provider: env.confidenceScoringMock ? "field-confidence-mock-v1" : "field-confidence-bedrock-v1",
      createdAt: now,
      triggerType: "auto",
      triggeredByUserId: user.userId,
      analysisStatus: "success",
      transcriptSegmentCountAtAnalysis: segmentCount,
      ...ret,
    };

    await analysisRepo.create(row);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.FIELD_CONFIDENCE_SCORED,
      details: {
        analysisId: row.analysisId,
        version,
        overallScore: agg.overallScore,
        pictureStatus: agg.pictureStatus,
        criticalGaps: agg.criticalGaps,
        hasConflicts: agg.hasConflicts,
        groundingDowngradeCount: groundingFlags.length,
      },
      createdAt: now,
      resourceType: "analysis",
      resourceId: row.analysisId,
    });

    if (groundingFlags.length > 0) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.AI_GROUNDING_DOWNGRADE,
        details: {
          analysisId: row.analysisId,
          version,
          flags: groundingFlags,
        },
        createdAt: now,
        resourceType: "analysis",
        resourceId: row.analysisId,
      });
    }

    return row;
  }
}
