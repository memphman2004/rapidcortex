import type {
  DataPathExport,
  Ng911CallProcessingMetrics,
  NgSecEvidencePack,
} from "rapid-cortex-shared";
import {
  NG_SEC_CONTROL_CATALOG,
  dataPathExportSchema,
  ng911CallProcessingMetricsSchema,
  ngSecEvidencePackSchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { getCrisisConfig } from "./crisisDiversionService.js";

const auditRepo = new AuditRepository();

/**
 * Call-processing style metrics for RC-owned NG9-1-1 assist surfaces, derived from the audit
 * trail (see `AUDIT_EVENT_TYPES`). Counts are best-effort: several downstream systems (e.g.
 * initial non-emergency queue writes) do not yet emit a dedicated "queued" audit event, so we
 * approximate using the closest available signal and note it inline below.
 */
export async function buildMetrics(
  agencyId: string,
  from: string,
  to: string,
): Promise<Ng911CallProcessingMetrics> {
  const events = await auditRepo.listByAgencyBetween(agencyId, from, to);

  let diversionSessionsStarted = 0;
  let diversionMatched = 0;
  let diversionSmsSent = 0;
  let diversionOptedOutToLive = 0;
  let diversionNoMatch = 0;

  let triageClassified = 0;
  let triageNonEmergencyQueued = 0;
  let triageEscalated = 0;
  let triageOverridden = 0;

  let transcriptAppends = 0;
  let eidoExports = 0;
  let eidoImports = 0;
  let additionalDataPackages = 0;
  let silentTextSessions = 0;
  let videoAssistStarts = 0;

  let assessmentsStarted = 0;
  let hardStops = 0;
  const byDestination: Record<string, number> = {};
  let warmTransfers = 0;
  let warmTransfersCompleted = 0;
  let clinicianConsults = 0;
  let clinicianCompleted = 0;
  let phoneResolved = 0;
  let divertedFromLe = 0;
  let divertedFromEms = 0;

  for (const ev of events) {
    switch (ev.type) {
      case AUDIT_EVENT_TYPES.DIVERSION_SESSION_STARTED:
        diversionSessionsStarted += 1;
        break;
      case AUDIT_EVENT_TYPES.DIVERSION_UTTERANCE_MATCHED:
        diversionMatched += 1;
        break;
      case AUDIT_EVENT_TYPES.DIVERSION_SMS_SENT:
        diversionSmsSent += 1;
        break;
      case AUDIT_EVENT_TYPES.DIVERSION_OPTED_OUT:
        diversionOptedOutToLive += 1;
        break;

      case AUDIT_EVENT_TYPES.TRIAGE_CLASSIFIED:
      case AUDIT_EVENT_TYPES.TRIAGE_RECORDED:
        triageClassified += 1;
        break;
      // No dedicated "queued" audit type exists yet; queue updates are the closest signal.
      case AUDIT_EVENT_TYPES.TRIAGE_QUEUE_UPDATED:
        triageNonEmergencyQueued += 1;
        break;
      case AUDIT_EVENT_TYPES.TRIAGE_ESCALATED:
        triageEscalated += 1;
        break;
      case AUDIT_EVENT_TYPES.TRIAGE_OVERRIDDEN:
        triageOverridden += 1;
        break;

      case AUDIT_EVENT_TYPES.TRANSCRIPT_APPEND:
        transcriptAppends += 1;
        break;
      case AUDIT_EVENT_TYPES.EIDO_EXPORTED:
        eidoExports += 1;
        break;
      case AUDIT_EVENT_TYPES.EIDO_IMPORTED:
        eidoImports += 1;
        break;
      case AUDIT_EVENT_TYPES.ADDITIONAL_DATA_UPDATED:
        additionalDataPackages += 1;
        break;
      case AUDIT_EVENT_TYPES.SILENT_TEXT_SESSION_CREATED:
        silentTextSessions += 1;
        break;
      case AUDIT_EVENT_TYPES.LIVE_VIDEO_REQUESTED:
        videoAssistStarts += 1;
        break;

      case AUDIT_EVENT_TYPES.CRISIS_ASSESSMENT_STARTED:
        assessmentsStarted += 1;
        break;
      case AUDIT_EVENT_TYPES.CRISIS_HARD_STOP:
        hardStops += 1;
        byDestination.le_ems = (byDestination.le_ems ?? 0) + 1;
        break;
      case AUDIT_EVENT_TYPES.CRISIS_DESTINATION_SELECTED: {
        const dest =
          typeof ev.details?.destinationType === "string"
            ? ev.details.destinationType
            : "unknown";
        byDestination[dest] = (byDestination[dest] ?? 0) + 1;
        break;
      }
      case AUDIT_EVENT_TYPES.CRISIS_WARM_TRANSFER_REQUESTED:
        warmTransfers += 1;
        break;
      case AUDIT_EVENT_TYPES.CRISIS_WARM_TRANSFER_COMPLETED:
        warmTransfersCompleted += 1;
        break;
      case AUDIT_EVENT_TYPES.CRISIS_CLINICIAN_CONSULT_CREATED:
        clinicianConsults += 1;
        break;
      case AUDIT_EVENT_TYPES.CRISIS_CLINICIAN_CONSULT_UPDATED: {
        if (ev.details?.status === "completed") clinicianCompleted += 1;
        break;
      }
      case AUDIT_EVENT_TYPES.CRISIS_OUTCOME_RECORDED: {
        if (ev.details?.phoneResolved === true) phoneResolved += 1;
        if (ev.details?.divertedFromLe === true) divertedFromLe += 1;
        if (ev.details?.divertedFromEms === true) divertedFromEms += 1;
        break;
      }
      default:
        break;
    }
  }

  // Utterances that didn't match anything but did not (yet) end in an explicit opt-out.
  diversionNoMatch = Math.max(
    0,
    diversionSessionsStarted - diversionMatched - diversionSmsSent - diversionOptedOutToLive,
  );

  const config = await getCrisisConfig(agencyId);
  const estimatedSavingsUsd =
    divertedFromLe * (config.unitCostAvoidedLeUsd ?? 0) +
    divertedFromEms * (config.unitCostAvoidedEmsUsd ?? 0);

  return ng911CallProcessingMetricsSchema.parse({
    agencyId,
    period: { from, to },
    diversion: {
      sessionsStarted: diversionSessionsStarted,
      matched: diversionMatched,
      smsSent: diversionSmsSent,
      optedOutToLive: diversionOptedOutToLive,
      noMatch: diversionNoMatch,
    },
    triage: {
      classified: triageClassified,
      nonEmergencyQueued: triageNonEmergencyQueued,
      escalated: triageEscalated,
      overridden: triageOverridden,
    },
    assist: {
      transcriptAppends,
      eidoExports,
      eidoImports,
      additionalDataPackages,
      silentTextSessions,
      videoAssistStarts,
    },
    crisis: {
      assessmentsStarted,
      hardStops,
      byDestination,
      warmTransfers,
      warmTransfersCompleted,
      clinicianConsults,
      clinicianCompleted,
      phoneResolved,
      divertedFromLe,
      divertedFromEms,
      estimatedSavingsUsd,
    },
    generatedAt: new Date().toISOString(),
  });
}

/** RFP-style NG-SEC evidence pack; includes a metrics snapshot when a period is provided. */
export async function buildNgSecEvidencePack(
  agencyId: string,
  from?: string,
  to?: string,
): Promise<NgSecEvidencePack> {
  const generatedAt = new Date().toISOString();
  const metricsSnapshot =
    from && to ? await buildMetrics(agencyId, from, to) : undefined;

  return ngSecEvidencePackSchema.parse({
    agencyId,
    packVersion: "RC-NG-SEC-1.0",
    generatedAt,
    controls: NG_SEC_CONTROL_CATALOG,
    metricsSnapshot,
  });
}

/** 911 DataPath-inspired element export for agency evidence (assistive, not official submission). */
export async function buildDataPathExport(
  agencyId: string,
  from: string,
  to: string,
): Promise<DataPathExport> {
  const metrics = await buildMetrics(agencyId, from, to);
  const crisis = metrics.crisis;

  return dataPathExportSchema.parse({
    agencyId,
    packVersion: "RC-DATAPATH-ASSIST-1.0",
    generatedAt: new Date().toISOString(),
    period: { from, to },
    disclaimer:
      "Assistive export aligned to 911 DataPath-style elements for agency evidence. Not a substitute for state/federal DataPath submissions.",
    elements: [
      {
        elementId: "RC.DIVERSION.SESSIONS",
        label: "Non-emergency diversion sessions started",
        category: "diversion",
        value: metrics.diversion.sessionsStarted,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.ASSESSMENTS",
        label: "Crisis assessments started",
        category: "crisis_diversion",
        value: crisis?.assessmentsStarted ?? 0,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.HARD_STOPS",
        label: "Crisis hard stops (LE/EMS)",
        category: "crisis_diversion",
        value: crisis?.hardStops ?? 0,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.WARM_TRANSFERS",
        label: "Warm transfers requested",
        category: "crisis_diversion",
        value: crisis?.warmTransfers ?? 0,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.PHONE_RESOLVED",
        label: "Crisis calls resolved on phone",
        category: "crisis_diversion",
        value: crisis?.phoneResolved ?? 0,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.DIVERTED_LE",
        label: "Diverted from LE response",
        category: "crisis_diversion",
        value: crisis?.divertedFromLe ?? 0,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.DIVERTED_EMS",
        label: "Diverted from EMS response",
        category: "crisis_diversion",
        value: crisis?.divertedFromEms ?? 0,
        source: "audit",
      },
      {
        elementId: "RC.CRISIS.EST_SAVINGS_USD",
        label: "Estimated savings (agency unit costs)",
        category: "cost",
        value: crisis?.estimatedSavingsUsd ?? 0,
        source: "agency_config",
      },
      {
        elementId: "RC.ASSIST.EIDO_EXPORTS",
        label: "EIDO exports",
        category: "interoperability",
        value: metrics.assist.eidoExports,
        source: "audit",
      },
    ],
  });
}
