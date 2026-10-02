import {
  SOP_INTELLIGENCE_PATTERN_THRESHOLD,
  type SopPatternThresholdDetail,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { broadcastToAgency } from "../lib/websocket/send-message.js";
import { generateSopLanguageSuggestion } from "./claude.js";
import { newPendingId, sopIntelligenceStore, type PendingSopUpdateRecord } from "./store.js";

const auditRepo = new AuditRepository();

export async function analyzeSopPattern(detail: SopPatternThresholdDetail): Promise<PendingSopUpdateRecord | null> {
  if (detail.gapCount < SOP_INTELLIGENCE_PATTERN_THRESHOLD) return null;

  const pattern = await sopIntelligenceStore.getPattern(detail.agencyId, detail.sopId, detail.stepId);
  if (!pattern || pattern.suggestionGenerated) return null;

  const claimed = await sopIntelligenceStore.claimPatternSuggestion(
    detail.agencyId,
    detail.sopId,
    detail.stepId,
  );
  if (!claimed) return null;

  const library = await sopIntelligenceStore.getLibraryDoc(detail.agencyId, detail.sopId);
  const step = library?.steps.find((s) => s.stepId === detail.stepId);
  if (!library || !step) return null;

  const reports = await sopIntelligenceStore.listGapReportsForSop(detail.agencyId, detail.sopId, 20);
  const stepReports = reports.filter((r) => r.stepId === detail.stepId);
  const suggestion = await generateSopLanguageSuggestion({
    sopTitle: library.title,
    step,
    gapDescription: pattern.latestGapDescription,
    evidenceCount: pattern.gapCount,
    reportNotes: stepReports.map((r) => r.gapDescription || r.whatHappened).filter(Boolean),
  });

  const now = new Date().toISOString();
  const updateId = newPendingId();
  const pending: PendingSopUpdateRecord = {
    PK: detail.agencyId,
    SK: `PENDING#${updateId}`,
    GSI1PK: `PENDING#${detail.agencyId}`,
    GSI1SK: now,
    agencyId: detail.agencyId,
    updateId,
    sopId: detail.sopId,
    stepId: detail.stepId,
    sopTitle: library.title,
    currentLang: step.text,
    suggestedLang: suggestion.suggestedLanguage,
    rationale: suggestion.rationale,
    evidence: suggestion.evidence,
    evidenceCount: pattern.gapCount,
    reportIds: pattern.reportIds,
    rootCauseType: suggestion.rootCauseType,
    confidence: suggestion.confidence,
    status: "pending",
    generatedAt: now,
    ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
  };
  await sopIntelligenceStore.putPending(pending);
  await sopIntelligenceStore.attachPendingToPattern(detail.agencyId, detail.sopId, detail.stepId, updateId);

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: detail.agencyId,
      actorId: "system:sop-pattern-analyzer",
      type: AUDIT_EVENT_TYPES.SOP_INTELLIGENCE_SUGGESTION_CREATED,
      details: { updateId, sopId: detail.sopId, stepId: detail.stepId, gapCount: pattern.gapCount },
      createdAt: now,
      resourceType: "agency",
      resourceId: updateId,
    });
  } catch (err) {
    console.warn(JSON.stringify({ msg: "sop_intel_audit_failed", err: String(err) }));
  }

  try {
    await broadcastToAgency({
      agencyId: detail.agencyId,
      message: {
        type: "sop-intel.suggestion.created",
        data: {
          updateId,
          sopId: detail.sopId,
          stepId: detail.stepId,
          sopTitle: library.title,
          gapCount: pattern.gapCount,
        },
      },
    });
  } catch (err) {
    console.warn(JSON.stringify({ msg: "sop_intel_ws_failed", err: String(err) }));
  }

  return pending;
}
