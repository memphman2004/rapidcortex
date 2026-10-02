import type {
  ClinicianConsult,
  ClinicianConsultPatchBody,
  CrisisAgencyConfig,
  CrisisAgencyConfigUpsertBody,
  CrisisAssessment,
  CrisisAssessmentAnswerBody,
  CrisisAssessmentStartBody,
  CrisisCompleteBody,
  CrisisDestination,
  CrisisDestinationType,
  CrisisDestinationUpsertBody,
  CrisisProtocol,
  CrisisProtocolStep,
  CrisisProtocolUpsertBody,
  CrisisSelectDestinationBody,
  CrisisWarmTransferBody,
  PartnerEidoHandoffBody,
  PartnerEidoHandoffResult,
} from "rapid-cortex-shared";
import {
  clinicianConsultSchema,
  crisisAgencyConfigSchema,
  crisisAssessmentSchema,
  crisisDestinationSchema,
  crisisProtocolSchema,
  crisisWarmTransferSchema,
  partnerEidoHandoffResultSchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { sendSilentTextSms } from "../../lib/silentTextSms.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { exportFromIncident } from "./eidoService.js";
import { ng911AssistStore } from "./ng911AssistStore.js";

const auditRepo = new AuditRepository();

const DEFAULT_STEPS: CrisisProtocolStep[] = [
  {
    stepId: "weapons",
    sortOrder: 0,
    question: "Are there weapons involved or accessible?",
    hardStopOnYes: true,
    hardStopReason: "weapons",
    helpText: "Any weapon report → LE/EMS response.",
  },
  {
    stepId: "crime",
    sortOrder: 1,
    question: "Is a crime in progress or has a crime just occurred?",
    hardStopOnYes: true,
    hardStopReason: "crime_in_progress",
  },
  {
    stepId: "medical",
    sortOrder: 2,
    question: "Is there an active medical emergency (breathing, bleeding, unconscious)?",
    hardStopOnYes: true,
    hardStopReason: "active_medical",
  },
  {
    stepId: "threat",
    sortOrder: 3,
    question: "Is anyone currently being threatened or attacked?",
    hardStopOnYes: true,
    hardStopReason: "hostile_threat",
  },
  {
    stepId: "bh_primary",
    sortOrder: 4,
    question: "Is this primarily a behavioral health / mental health crisis with no hard-stop factors?",
    hardStopOnYes: false,
    suggestDestinationOnNo: "le_ems",
    helpText: "If yes, continue toward 988 / mobile crisis / community responder.",
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

async function audit(
  agencyId: string,
  actorId: string,
  type: string,
  details: Record<string, unknown>,
  resourceType: "agency" | "incident" = "agency",
  resourceId?: string,
  incidentId?: string,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type,
    details,
    createdAt: nowIso(),
    resourceType,
    resourceId: resourceId ?? agencyId,
    ...(incidentId ? { incidentId } : {}),
  });
}

/** Seed a CSG-style starter protocol when the agency has none. */
export async function ensureDefaultCrisisProtocol(
  agencyId: string,
  actorId: string,
): Promise<CrisisProtocol> {
  const existing = await ng911AssistStore.listCrisisProtocols(agencyId);
  const enabled = existing.find((p) => p.enabled);
  if (enabled) return enabled;
  if (existing[0]) return existing[0];

  const ts = nowIso();
  const protocol = crisisProtocolSchema.parse({
    protocolId: makeId("crproto"),
    agencyId,
    name: "Behavioral health safety screen",
    description:
      "Starter hard-stop screen (weapons / crime / medical / threat) then behavioral-health routing. Customize for local policy.",
    enabled: true,
    defaultRiskLevel: 2,
    steps: DEFAULT_STEPS,
    defaultDestination: "988",
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
  });
  await ng911AssistStore.putCrisisProtocol(protocol);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_PROTOCOL_UPSERTED, {
    protocolId: protocol.protocolId,
    seeded: true,
  });
  return protocol;
}

export async function getCrisisConfig(agencyId: string): Promise<CrisisAgencyConfig> {
  const existing = await ng911AssistStore.getCrisisConfig(agencyId);
  if (existing) return existing;
  return crisisAgencyConfigSchema.parse({
    agencyId,
    enabled: true,
    warmTransferMock: true,
    updatedAt: nowIso(),
  });
}

export async function upsertCrisisConfig(
  agencyId: string,
  actorId: string,
  body: CrisisAgencyConfigUpsertBody,
): Promise<CrisisAgencyConfig> {
  const existing = await getCrisisConfig(agencyId);
  const config = crisisAgencyConfigSchema.parse({
    ...existing,
    ...body,
    agencyId,
    updatedAt: nowIso(),
  });
  await ng911AssistStore.putCrisisConfig(config);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_CONFIG_UPDATED, {
    enabled: config.enabled,
    defaultProtocolId: config.defaultProtocolId,
  });
  return config;
}

export async function listCrisisProtocols(agencyId: string): Promise<CrisisProtocol[]> {
  return ng911AssistStore.listCrisisProtocols(agencyId);
}

export async function upsertCrisisProtocol(
  agencyId: string,
  actorId: string,
  body: CrisisProtocolUpsertBody,
): Promise<CrisisProtocol> {
  const ts = nowIso();
  const existing = body.protocolId
    ? await ng911AssistStore.getCrisisProtocol(agencyId, body.protocolId)
    : null;
  const protocol = crisisProtocolSchema.parse({
    protocolId: body.protocolId ?? makeId("crproto"),
    agencyId,
    name: body.name,
    description: body.description,
    enabled: body.enabled ?? existing?.enabled ?? true,
    defaultRiskLevel: body.defaultRiskLevel ?? existing?.defaultRiskLevel,
    steps: body.steps,
    defaultDestination: body.defaultDestination ?? existing?.defaultDestination ?? "le_ems",
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
    createdBy: existing?.createdBy ?? actorId,
  });
  await ng911AssistStore.putCrisisProtocol(protocol);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_PROTOCOL_UPSERTED, {
    protocolId: protocol.protocolId,
    name: protocol.name,
    created: !existing,
  });
  return protocol;
}

export async function deleteCrisisProtocol(
  agencyId: string,
  actorId: string,
  protocolId: string,
): Promise<void> {
  await ng911AssistStore.deleteCrisisProtocol(agencyId, protocolId);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_PROTOCOL_DELETED, { protocolId });
}

export async function listCrisisDestinations(agencyId: string): Promise<CrisisDestination[]> {
  return ng911AssistStore.listCrisisDestinations(agencyId);
}

export async function upsertCrisisDestination(
  agencyId: string,
  actorId: string,
  body: CrisisDestinationUpsertBody,
): Promise<CrisisDestination> {
  const ts = nowIso();
  const existing = body.destinationId
    ? await ng911AssistStore.getCrisisDestination(agencyId, body.destinationId)
    : null;
  const dest = crisisDestinationSchema.parse({
    destinationId: body.destinationId ?? makeId("crdest"),
    agencyId,
    type: body.type,
    name: body.name,
    phoneE164: body.phoneE164,
    portalUrl: body.portalUrl,
    smsTemplate: body.smsTemplate,
    notes: body.notes,
    enabled: body.enabled ?? existing?.enabled ?? true,
    sortOrder: body.sortOrder ?? existing?.sortOrder ?? 0,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  });
  await ng911AssistStore.putCrisisDestination(dest);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_DESTINATION_UPSERTED, {
    destinationId: dest.destinationId,
    type: dest.type,
    created: !existing,
  });
  return dest;
}

export async function deleteCrisisDestination(
  agencyId: string,
  actorId: string,
  destinationId: string,
): Promise<void> {
  await ng911AssistStore.deleteCrisisDestination(agencyId, destinationId);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_DESTINATION_DELETED, { destinationId });
}

function recommendFromAnswers(
  protocol: CrisisProtocol,
  answers: CrisisAssessment["answers"],
): CrisisDestinationType {
  const byStep = new Map(protocol.steps.map((s) => [s.stepId, s]));
  for (const a of answers) {
    if (a.hardStopTriggered) return "le_ems";
    const step = byStep.get(a.stepId);
    if (a.answer === "no" && step?.suggestDestinationOnNo) {
      return step.suggestDestinationOnNo;
    }
  }
  // If behavioral-health affirmative without hard stop, prefer protocol default.
  const bh = answers.find((a) => a.stepId === "bh_primary");
  if (bh?.answer === "yes") return protocol.defaultDestination;
  return protocol.defaultDestination;
}

export async function startCrisisAssessment(
  agencyId: string,
  actorId: string,
  body: CrisisAssessmentStartBody,
): Promise<{ assessment: CrisisAssessment; protocol: CrisisProtocol }> {
  const config = await getCrisisConfig(agencyId);
  if (!config.enabled) throw new Error("CRISIS_DISABLED");

  let protocolId = body.protocolId ?? config.defaultProtocolId;
  let protocol = protocolId
    ? await ng911AssistStore.getCrisisProtocol(agencyId, protocolId)
    : null;
  if (!protocol) {
    protocol = await ensureDefaultCrisisProtocol(agencyId, actorId);
  }
  if (!protocol.enabled) throw new Error("PROTOCOL_DISABLED");

  const ts = nowIso();
  const assessment = crisisAssessmentSchema.parse({
    assessmentId: makeId("crassess"),
    agencyId,
    incidentId: body.incidentId,
    protocolId: protocol.protocolId,
    protocolName: protocol.name,
    status: "in_progress",
    answers: [],
    actorId,
    createdAt: ts,
    updatedAt: ts,
  });
  await ng911AssistStore.putCrisisAssessment(assessment);
  await audit(
    agencyId,
    actorId,
    AUDIT_EVENT_TYPES.CRISIS_ASSESSMENT_STARTED,
    { assessmentId: assessment.assessmentId, protocolId: protocol.protocolId },
    body.incidentId ? "incident" : "agency",
    body.incidentId ?? agencyId,
    body.incidentId,
  );
  return { assessment, protocol };
}

export async function answerCrisisStep(
  agencyId: string,
  actorId: string,
  body: CrisisAssessmentAnswerBody,
): Promise<CrisisAssessment> {
  const assessment = await ng911AssistStore.getCrisisAssessment(agencyId, body.assessmentId);
  if (!assessment) throw new Error("NOT_FOUND");
  if (assessment.status !== "in_progress") throw new Error("ASSESSMENT_NOT_OPEN");

  const protocol = await ng911AssistStore.getCrisisProtocol(agencyId, assessment.protocolId);
  if (!protocol) throw new Error("PROTOCOL_NOT_FOUND");

  const step = protocol.steps.find((s) => s.stepId === body.stepId);
  if (!step) throw new Error("STEP_NOT_FOUND");

  const ts = nowIso();
  const hardStopTriggered = Boolean(step.hardStopOnYes && body.answer === "yes");
  const answer = {
    stepId: step.stepId,
    question: step.question,
    answer: body.answer,
    hardStopTriggered,
    answeredAt: ts,
  };

  const answers = [
    ...assessment.answers.filter((a) => a.stepId !== step.stepId),
    answer,
  ].sort((a, b) => {
    const ao = protocol.steps.find((s: CrisisProtocolStep) => s.stepId === a.stepId)?.sortOrder ?? 0;
    const bo = protocol.steps.find((s: CrisisProtocolStep) => s.stepId === b.stepId)?.sortOrder ?? 0;
    return ao - bo;
  });

  let next: CrisisAssessment;
  if (hardStopTriggered) {
    next = crisisAssessmentSchema.parse({
      ...assessment,
      answers,
      status: "hard_stopped",
      hardStopReason: step.hardStopReason ?? "other_public_safety",
      recommendedDestination: "le_ems",
      selectedDestination: "le_ems",
      updatedAt: ts,
    });
    await ng911AssistStore.putCrisisAssessment(next);
    await audit(
      agencyId,
      actorId,
      AUDIT_EVENT_TYPES.CRISIS_HARD_STOP,
      {
        assessmentId: next.assessmentId,
        stepId: step.stepId,
        reason: next.hardStopReason,
      },
      assessment.incidentId ? "incident" : "agency",
      assessment.incidentId ?? agencyId,
      assessment.incidentId,
    );
    return next;
  }

  const allAnswered = protocol.steps.every((s: CrisisProtocolStep) =>
    answers.some((a) => a.stepId === s.stepId),
  );
  const recommended = recommendFromAnswers(protocol, answers);
  next = crisisAssessmentSchema.parse({
    ...assessment,
    answers,
    recommendedDestination: recommended,
    status: allAnswered ? "destination_selected" : "in_progress",
    updatedAt: ts,
  });
  await ng911AssistStore.putCrisisAssessment(next);
  return next;
}

export async function selectCrisisDestination(
  agencyId: string,
  actorId: string,
  body: CrisisSelectDestinationBody,
): Promise<CrisisAssessment> {
  const assessment = await ng911AssistStore.getCrisisAssessment(agencyId, body.assessmentId);
  if (!assessment) throw new Error("NOT_FOUND");
  if (assessment.status === "completed" || assessment.status === "cancelled") {
    throw new Error("ASSESSMENT_CLOSED");
  }
  if (assessment.status === "hard_stopped" && body.destinationType !== "le_ems") {
    throw new Error("HARD_STOP_REQUIRES_LE_EMS");
  }

  let dest: CrisisDestination | null = null;
  if (body.destinationId) {
    dest = await ng911AssistStore.getCrisisDestination(agencyId, body.destinationId);
    if (!dest || dest.type !== body.destinationType) throw new Error("DESTINATION_MISMATCH");
  } else {
    const list = await ng911AssistStore.listCrisisDestinations(agencyId);
    dest =
      list.find((d) => d.enabled && d.type === body.destinationType) ??
      list.find((d) => d.type === body.destinationType) ??
      null;
  }

  if (body.destinationType === "portal_sms" && body.callerPhoneE164) {
    const template =
      dest?.smsTemplate ??
      "Your local public safety agency shared a non-emergency resource link. This is not a substitute for calling 911 in an emergency.";
    const url = dest?.portalUrl ? ` ${dest.portalUrl}` : "";
    await sendSilentTextSms({
      phoneE164: body.callerPhoneE164,
      message: `${template}${url}`.slice(0, 480),
      agencyId,
      incidentId: assessment.incidentId ?? assessment.assessmentId,
    });
  }

  const ts = nowIso();
  const next = crisisAssessmentSchema.parse({
    ...assessment,
    status: "destination_selected",
    selectedDestination: body.destinationType,
    selectedDestinationId: dest?.destinationId ?? body.destinationId,
    recommendedDestination: assessment.recommendedDestination ?? body.destinationType,
    updatedAt: ts,
  });
  await ng911AssistStore.putCrisisAssessment(next);
  await audit(
    agencyId,
    actorId,
    AUDIT_EVENT_TYPES.CRISIS_DESTINATION_SELECTED,
    {
      assessmentId: next.assessmentId,
      destinationType: body.destinationType,
      destinationId: next.selectedDestinationId,
    },
    assessment.incidentId ? "incident" : "agency",
    assessment.incidentId ?? agencyId,
    assessment.incidentId,
  );
  return next;
}

export async function requestWarmTransfer(
  agencyId: string,
  actorId: string,
  body: CrisisWarmTransferBody,
): Promise<CrisisAssessment> {
  const assessment = await ng911AssistStore.getCrisisAssessment(agencyId, body.assessmentId);
  if (!assessment) throw new Error("NOT_FOUND");
  if (!assessment.selectedDestination && assessment.status !== "hard_stopped") {
    throw new Error("DESTINATION_REQUIRED");
  }

  const config = await getCrisisConfig(agencyId);
  const destType = assessment.selectedDestination ?? "le_ems";
  let dest: CrisisDestination | null = null;
  if (body.destinationId) {
    dest = await ng911AssistStore.getCrisisDestination(agencyId, body.destinationId);
  } else if (assessment.selectedDestinationId) {
    dest = await ng911AssistStore.getCrisisDestination(agencyId, assessment.selectedDestinationId);
  }

  const ts = nowIso();
  const mock = config.warmTransferMock !== false;
  const transfer = crisisWarmTransferSchema.parse({
    transferId: makeId("crxfer"),
    status: mock ? "connected" : "ringing",
    destinationType: destType,
    destinationId: dest?.destinationId,
    destinationName: dest?.name,
    phoneE164: body.phoneE164 ?? dest?.phoneE164,
    notes: body.notes,
    mock,
    requestedAt: ts,
    updatedAt: ts,
    ...(mock ? { completedAt: ts } : {}),
  });

  // Mock telephony: mark completed in the same request when mock mode is on.
  const finalTransfer = mock
    ? crisisWarmTransferSchema.parse({ ...transfer, status: "completed", completedAt: ts })
    : transfer;

  const next = crisisAssessmentSchema.parse({
    ...assessment,
    status: "handoff_in_progress",
    warmTransfer: finalTransfer,
    updatedAt: ts,
  });
  await ng911AssistStore.putCrisisAssessment(next);
  await audit(
    agencyId,
    actorId,
    AUDIT_EVENT_TYPES.CRISIS_WARM_TRANSFER_REQUESTED,
    {
      assessmentId: next.assessmentId,
      transferId: finalTransfer.transferId,
      mock,
      destinationType: destType,
    },
    assessment.incidentId ? "incident" : "agency",
    assessment.incidentId ?? agencyId,
    assessment.incidentId,
  );
  if (finalTransfer.status === "completed") {
    await audit(
      agencyId,
      actorId,
      AUDIT_EVENT_TYPES.CRISIS_WARM_TRANSFER_COMPLETED,
      { assessmentId: next.assessmentId, transferId: finalTransfer.transferId, mock: true },
      assessment.incidentId ? "incident" : "agency",
      assessment.incidentId ?? agencyId,
      assessment.incidentId,
    );
  }
  return next;
}

export async function completeCrisisAssessment(
  agencyId: string,
  actorId: string,
  body: CrisisCompleteBody,
): Promise<CrisisAssessment> {
  const assessment = await ng911AssistStore.getCrisisAssessment(agencyId, body.assessmentId);
  if (!assessment) throw new Error("NOT_FOUND");

  const ts = nowIso();
  const next = crisisAssessmentSchema.parse({
    ...assessment,
    status: "completed",
    phoneResolved: body.phoneResolved,
    divertedFromLe: body.divertedFromLe,
    divertedFromEms: body.divertedFromEms,
    outcomeNotes: body.outcomeNotes,
    updatedAt: ts,
    completedAt: ts,
  });
  await ng911AssistStore.putCrisisAssessment(next);
  await audit(
    agencyId,
    actorId,
    AUDIT_EVENT_TYPES.CRISIS_OUTCOME_RECORDED,
    {
      assessmentId: next.assessmentId,
      phoneResolved: next.phoneResolved,
      divertedFromLe: next.divertedFromLe,
      divertedFromEms: next.divertedFromEms,
      selectedDestination: next.selectedDestination,
    },
    assessment.incidentId ? "incident" : "agency",
    assessment.incidentId ?? agencyId,
    assessment.incidentId,
  );
  return next;
}

export async function getCrisisAssessment(
  agencyId: string,
  assessmentId: string,
): Promise<CrisisAssessment | null> {
  return ng911AssistStore.getCrisisAssessment(agencyId, assessmentId);
}

export async function listCrisisAssessments(
  agencyId: string,
  limit = 100,
): Promise<CrisisAssessment[]> {
  return ng911AssistStore.listCrisisAssessments(agencyId, limit);
}

export async function createClinicianConsult(
  agencyId: string,
  actorId: string,
  assessmentId: string,
  summary?: string,
): Promise<{ consult: ClinicianConsult; assessment: CrisisAssessment }> {
  const assessment = await ng911AssistStore.getCrisisAssessment(agencyId, assessmentId);
  if (!assessment) throw new Error("NOT_FOUND");

  const ts = nowIso();
  const consult = clinicianConsultSchema.parse({
    consultId: makeId("crconsult"),
    agencyId,
    assessmentId,
    incidentId: assessment.incidentId,
    status: "pending",
    summary:
      summary ??
      `Crisis consult for assessment ${assessmentId}` +
        (assessment.recommendedDestination
          ? ` (recommended: ${assessment.recommendedDestination})`
          : ""),
    createdAt: ts,
    updatedAt: ts,
  });
  await ng911AssistStore.putClinicianConsult(consult);

  const next = crisisAssessmentSchema.parse({
    ...assessment,
    clinicianConsultId: consult.consultId,
    updatedAt: ts,
  });
  await ng911AssistStore.putCrisisAssessment(next);
  await audit(
    agencyId,
    actorId,
    AUDIT_EVENT_TYPES.CRISIS_CLINICIAN_CONSULT_CREATED,
    { consultId: consult.consultId, assessmentId },
    assessment.incidentId ? "incident" : "agency",
    assessment.incidentId ?? agencyId,
    assessment.incidentId,
  );
  return { consult, assessment: next };
}

export async function listClinicianConsults(
  agencyId: string,
  limit = 100,
): Promise<ClinicianConsult[]> {
  return ng911AssistStore.listClinicianConsults(agencyId, limit);
}

export async function patchClinicianConsult(
  agencyId: string,
  actorId: string,
  consultId: string,
  body: ClinicianConsultPatchBody,
): Promise<ClinicianConsult> {
  const existing = await ng911AssistStore.getClinicianConsult(agencyId, consultId);
  if (!existing) throw new Error("NOT_FOUND");
  const ts = nowIso();
  const next = clinicianConsultSchema.parse({
    ...existing,
    ...body,
    updatedAt: ts,
    ...(body.status === "completed" || body.status === "escalated_le" || body.status === "cancelled"
      ? { completedAt: ts }
      : {}),
  });
  await ng911AssistStore.putClinicianConsult(next);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CRISIS_CLINICIAN_CONSULT_UPDATED, {
    consultId,
    status: next.status,
  });
  return next;
}

export async function partnerEidoHandoff(
  agencyId: string,
  actorId: string,
  body: PartnerEidoHandoffBody,
): Promise<PartnerEidoHandoffResult> {
  const eido = await exportFromIncident(
    agencyId,
    body.incidentId,
    body.includeAdditionalData ?? true,
  );
  const handoffId = makeId("eidohand");
  const ts = nowIso();
  const dryRun = body.dryRun === true || !body.partnerWebhookUrl;

  let status: PartnerEidoHandoffResult["status"] = dryRun ? "delivered_mock" : "stored";
  let error: string | undefined;

  if (!dryRun && body.partnerWebhookUrl) {
    try {
      const res = await fetch(body.partnerWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-RC-Partner-Handoff": handoffId },
        body: JSON.stringify({
          handoffId,
          partnerAgencyId: body.partnerAgencyId,
          eido,
        }),
      });
      status = res.ok ? "delivered" : "failed";
      if (!res.ok) error = `Partner webhook HTTP ${res.status}`;
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : "webhook_failed";
    }
  }

  const result = partnerEidoHandoffResultSchema.parse({
    handoffId,
    incidentId: body.incidentId,
    partnerAgencyId: body.partnerAgencyId,
    status,
    eidoId: eido.incidentId,
    deliveredAt: ts,
    error,
  });

  await ng911AssistStore.putPartnerHandoff(agencyId, {
    ...result,
    createdAt: ts,
    actorId,
  });
  await audit(
    agencyId,
    actorId,
    AUDIT_EVENT_TYPES.PARTNER_EIDO_HANDOFF,
    {
      handoffId,
      partnerAgencyId: body.partnerAgencyId,
      status,
      dryRun,
    },
    "incident",
    body.incidentId,
    body.incidentId,
  );
  return result;
}
