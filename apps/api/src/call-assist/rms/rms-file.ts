import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { IncidentReport } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { getRmsAdapter, resolveAgencyRmsConfig } from "../../lib/rms/adapters.js";
import { isRmsMockMode } from "../../lib/rms/claude-report.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import type { CallAssistSessionRecord } from "../store.js";
import { callAssistStore } from "../store.js";
import { evaluateRmsDraftGate } from "./rms-draft.js";
import { submitMotorolaRecords } from "./motorola-records.js";

function toIncidentReport(session: CallAssistSessionRecord, actorId: string, classification: string): IncidentReport {
  const plate = session.intake.vehiclePlate?.trim();
  return {
    reportId: session.sessionId,
    agencyId: session.agencyId,
    incidentId: session.sessionId,
    incidentType: classification,
    incidentDate: session.createdAt.slice(0, 10),
    incidentTime: session.createdAt.slice(11, 16) || "00:00",
    incidentAddress: session.intake.locationText ?? "",
    incidentCity: "",
    incidentState: "",
    suspects: [],
    victims: [],
    witnesses: [],
    vehicles: plate
      ? [
          {
            make: session.intake.vehicleMake,
            model: session.intake.vehicleModel,
            year: session.intake.vehicleYear,
            color: session.intake.vehicleColor,
            plate,
            extractedFromCall: true,
          },
        ]
      : [],
    narrative: { officerNarrative: session.intake.summary ?? "" },
    nibrsConfirmed: false,
    status: "draft",
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    createdBy: actorId,
    cadIncidentNumber: session.cadIncidentId,
    caseNumber: session.caseNumber,
    transcriptWordCount: session.utterances.reduce((n, u) => n + u.text.split(/\s+/).length, 0),
    extractedEntitiesCount: plate ? 1 : 0,
  };
}

const auditRepo = new AuditRepository();

export type RmsFileResult = {
  ok: boolean;
  blocked: boolean;
  draftId?: string;
  reportNumber?: string;
  externalId?: string;
  reason: string;
  target?: string;
};

export async function fileCallAssistRms(opts: {
  session: CallAssistSessionRecord;
  actorId: string;
  humanReviewApproved: boolean;
  target?: string;
  source?: "call_assist" | "online_reporting";
}): Promise<RmsFileResult> {
  const demo = opts.session.source === "DEMO";
  const draft = evaluateRmsDraftGate({
    rmsDraftEnabled: env.enableCallAssistRmsDraft || demo || isRmsMockMode(),
    humanReviewApproved: opts.humanReviewApproved,
    demo,
  });
  if (draft.blocked && !demo) {
    opts.session.rmsDraftStatus = draft.reason;
    opts.session.updatedAt = new Date().toISOString();
    await callAssistStore.putSession(opts.session);
    return { ...draft, target: opts.target };
  }

  const payload = {
    agencyId: opts.session.agencyId,
    intake: opts.session.intake,
    classification: opts.session.triage?.primaryClassification ?? "REPORT_ONLY",
    location: {
      text: opts.session.intake.locationText,
      lat: opts.session.intake.locationLat,
      lng: opts.session.intake.locationLng,
    },
  };

  const resolved = await resolveAgencyRmsConfig(opts.session.agencyId);
  const target = opts.target || resolved.target || "motorola-records";

  let result: RmsFileResult;
  if (target === "motorola-records") {
    const live = await submitMotorolaRecords({
      payload,
      sessionId: opts.session.sessionId,
      demo: demo || !env.enableCallAssistRmsDraft,
    });
    result = {
      ok: live.ok,
      blocked: live.blocked,
      draftId: draft.draftId,
      reportNumber: live.reportNumber,
      externalId: live.externalId,
      reason: live.reason,
      target,
    };
  } else {
    try {
      const adapter = getRmsAdapter(target, resolved.config);
      const pushed = await adapter.push(toIncidentReport(opts.session, opts.actorId, payload.classification));
      result = {
        ok: true,
        blocked: false,
        draftId: draft.draftId,
        reportNumber: pushed.externalId,
        externalId: pushed.externalId,
        reason: pushed.status === "pushed" ? "rms_filed" : "pending_vendor",
        target,
      };
    } catch (err) {
      result = {
        ok: false,
        blocked: true,
        reason: err instanceof Error ? err.message.slice(0, 180) : "rms_file_failed",
        target,
      };
    }
  }

  const now = new Date().toISOString();
  opts.session.rmsDraftStatus = result.reason;
  opts.session.rmsReportNumber = result.reportNumber;
  opts.session.rmsExternalId = result.externalId;
  opts.session.rmsTarget = target;
  opts.session.updatedAt = now;
  await callAssistStore.putSession(opts.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: result.ok ? AUDIT_EVENT_TYPES.CALL_ASSIST_RMS_FILED : AUDIT_EVENT_TYPES.CALL_ASSIST_RMS_FILE_BLOCKED,
    details: { ...result, source: opts.source ?? "call_assist", sessionId: opts.session.sessionId },
    createdAt: now,
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });
  return result;
}
