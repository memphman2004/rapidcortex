/**
 * Nova Sonic tool handlers for Call Assist.
 * Tools update session state and produce Connect handoff attributes.
 */
import {
  checkEmergencyKeywords,
  emptyNovaSonicConnectHandoffAttrs,
  formatCallAssistCaseNumber,
  caseStatusReadout,
  caseNotFoundVoice,
  reopenAcknowledgementVoice,
  escalationAcknowledgementVoice,
  escalationCapVoice,
  formatConfirmationForSpeech,
  isValidConfirmationFormat,
  type NovaSonicConnectHandoffAttrs,
  type NovaSonicToolName,
} from "rapid-cortex-shared";
import { callAssistStore, type CallAssistTenantConfig } from "../store.js";

export type NovaSonicIntakeState = {
  locationText?: string;
  incidentTypeHint?: string;
  summary?: string;
  callbackNumber?: string;
  vehicleDescription?: string;
  plate?: string;
  confirmationNumber?: string;
  emergencyReason?: string;
  humanRequested?: boolean;
};

export type NovaSonicToolContext = {
  agencyId: string;
  contactId: string;
  config?: CallAssistTenantConfig | null;
  intake: NovaSonicIntakeState;
  /** ANI from Connect contact flow. Never used as a trust anchor — lookup-only. */
  ani?: string;
};

export type NovaSonicToolResult = {
  ok: boolean;
  toolName: NovaSonicToolName;
  payload: Record<string, unknown>;
  handoff?: Partial<NovaSonicConnectHandoffAttrs>;
  intakePatch?: Partial<NovaSonicIntakeState>;
};

function asRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function parseNovaSonicToolInput(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return { raw };
    }
  }
  return asRecord(raw);
}

export function executeNovaSonicTool(
  toolName: string,
  rawInput: unknown,
  ctx: NovaSonicToolContext,
): NovaSonicToolResult {
  const input = parseNovaSonicToolInput(rawInput);
  switch (toolName as NovaSonicToolName) {
    case "transfer_emergency": {
      const reason = str(input.reason) || str(input.matchedPhrase) || "emergency";
      return {
        ok: true,
        toolName: "transfer_emergency",
        payload: { transferred: true, reason },
        intakePatch: { emergencyReason: reason },
        handoff: {
          emergencyEscalation: "true",
          callerDone: "false",
          novaSonicFallbackToLex: "false",
          novaSessionStatus: "EMERGENCY",
          escalationAnnouncement: "I'm transferring you to emergency services now.",
        },
      };
    }
    case "issue_report_number": {
      const confirmationNumber =
        ctx.intake.confirmationNumber?.trim() ||
        formatCallAssistCaseNumber({
          agencyId: ctx.agencyId,
          confirmationPrefix: ctx.config?.confirmationPrefix,
          timeZone: ctx.config?.operatingHours?.timezone,
        });
      return {
        ok: true,
        toolName: "issue_report_number",
        payload: {
          confirmationNumber,
          speak: `Your report number is ${confirmationNumber}. I'll repeat that — ${confirmationNumber}. Someone will be in touch.`,
        },
        intakePatch: {
          confirmationNumber,
          locationText: str(input.locationText) || ctx.intake.locationText,
          incidentTypeHint: str(input.incidentTypeHint) || ctx.intake.incidentTypeHint,
          summary: str(input.summary) || ctx.intake.summary,
        },
        handoff: {
          callerDone: "true",
          confirmationNumber,
          novaSessionStatus: "COMPLETED",
          emergencyEscalation: "false",
          novaSonicFallbackToLex: "false",
        },
      };
    }
    case "save_intake_fields": {
      const patch: Partial<NovaSonicIntakeState> = {};
      for (const key of [
        "locationText",
        "incidentTypeHint",
        "summary",
        "callbackNumber",
        "vehicleDescription",
        "plate",
      ] as const) {
        const v = str(input[key]);
        if (v) patch[key] = v;
      }
      return {
        ok: true,
        toolName: "save_intake_fields",
        payload: { saved: true, fields: Object.keys(patch) },
        intakePatch: patch,
      };
    }
    case "request_human": {
      const reason = str(input.reason) || "caller_requested_human";
      return {
        ok: true,
        toolName: "request_human",
        payload: { handedOff: true, reason },
        intakePatch: { humanRequested: true },
        handoff: {
          callerDone: "false",
          novaSonicFallbackToLex: "true",
          novaSessionStatus: "HUMAN",
          novaFallbackReason: reason,
        },
      };
    }
    default:
      return {
        ok: false,
        toolName: "save_intake_fields",
        payload: { error: `unknown_tool:${toolName}` },
      };
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — Lifecycle tools (async, DynamoDB-backed)
// ---------------------------------------------------------------------------

/**
 * Execute a Phase 1 lifecycle tool (lookup, reopen, escalate, note).
 * Returns null for unrecognized tool names so the caller can decide fallback behavior.
 *
 * SECURITY:
 *  - agencyId ALWAYS comes from ctx.agencyId (set from Connect DID context, never from caller input).
 *  - ANI may identify candidates but is never sufficient alone for protected writes.
 *    Reopen/escalate always re-read the record and validate agencyId before writing.
 *  - Cross-tenant writes are impossible: store methods enforce agencyId === record.agencyId.
 */
export async function executeNovaSonicLifecycleTool(
  toolName: string,
  rawInput: unknown,
  ctx: NovaSonicToolContext,
): Promise<NovaSonicToolResult | null> {
  const input = parseNovaSonicToolInput(rawInput);
  const agencyId = ctx.agencyId;

  switch (toolName as NovaSonicToolName) {
    case "lookup_call_record": {
      const rawConfirmation = str(input.confirmationNumber).toUpperCase();
      let record =
        isValidConfirmationFormat(rawConfirmation) && agencyId
          ? await callAssistStore.lookupCallRecord(agencyId, rawConfirmation).catch(() => null)
          : null;
      // ANI fallback when no confirmation number provided
      if (!record && ctx.ani && agencyId) {
        record = await callAssistStore.findLatestRecordByAni(agencyId, ctx.ani).catch(() => null);
      }
      if (!record) {
        const notFoundText = caseNotFoundVoice(rawConfirmation || "that number");
        return {
          ok: false,
          toolName: "lookup_call_record",
          payload: { found: false, speak: notFoundText },
        };
      }
      const readout = caseStatusReadout(record);
      return {
        ok: true,
        toolName: "lookup_call_record",
        payload: {
          found: true,
          confirmationNumber: record.confirmationNumber,
          status: record.status,
          department: record.department,
          speak: readout.voiceText,
        },
        intakePatch: { confirmationNumber: record.confirmationNumber },
      };
    }

    case "reopen_service_request": {
      const rawConfirmation = str(input.confirmationNumber).toUpperCase();
      const reason = str(input.reason) || "Caller reported issue returned";
      if (!agencyId || !rawConfirmation) {
        return { ok: false, toolName: "reopen_service_request", payload: { error: "missing_confirmation" } };
      }
      const result = await callAssistStore.requestCaseReopen({
        agencyId,
        confirmationNumber: rawConfirmation,
        note: reason.slice(0, 200),
        updatedBy: "RESIDENT_VOICE",
      }).catch(() => null);
      if (!result) {
        return {
          ok: false,
          toolName: "reopen_service_request",
          payload: { speak: `I noted your request for report ${formatConfirmationForSpeech(rawConfirmation)}. Someone will review it.` },
        };
      }
      if (!result.ok) {
        const speakText =
          result.error === "REOPEN_ALREADY_PENDING"
            ? `A reopen request is already pending for report ${formatConfirmationForSpeech(rawConfirmation)}.`
            : result.error === "TERMINAL_STATUS"
              ? `Report ${formatConfirmationForSpeech(rawConfirmation)} is in a final status and cannot be reopened.`
              : `I wasn't able to submit the reopen request. Please try again.`;
        return { ok: false, toolName: "reopen_service_request", payload: { error: result.error, speak: speakText } };
      }
      return {
        ok: true,
        toolName: "reopen_service_request",
        payload: {
          confirmationNumber: result.value.confirmationNumber,
          speak: reopenAcknowledgementVoice(formatConfirmationForSpeech(result.value.confirmationNumber)),
        },
        intakePatch: { confirmationNumber: result.value.confirmationNumber },
      };
    }

    case "escalate_service_request": {
      const rawConfirmation = str(input.confirmationNumber).toUpperCase();
      const reason = str(input.reason) || "Caller requested priority review";
      if (!agencyId || !rawConfirmation) {
        return { ok: false, toolName: "escalate_service_request", payload: { error: "missing_confirmation" } };
      }
      const result = await callAssistStore.requestCaseEscalation({
        agencyId,
        confirmationNumber: rawConfirmation,
        note: reason.slice(0, 200),
        updatedBy: "RESIDENT_VOICE",
      }).catch(() => null);
      if (!result) {
        return {
          ok: false,
          toolName: "escalate_service_request",
          payload: { speak: `I noted your escalation request for report ${formatConfirmationForSpeech(rawConfirmation)}.` },
        };
      }
      if (!result.ok) {
        const speakText =
          result.error === "ESCALATION_CAP_EXCEEDED"
            ? escalationCapVoice(formatConfirmationForSpeech(rawConfirmation))
            : result.error === "TERMINAL_STATUS"
              ? `Report ${formatConfirmationForSpeech(rawConfirmation)} is in a final status and cannot be escalated.`
              : `I wasn't able to submit the escalation. Please try again or call the non-emergency line.`;
        return { ok: false, toolName: "escalate_service_request", payload: { error: result.error, speak: speakText } };
      }
      return {
        ok: true,
        toolName: "escalate_service_request",
        payload: {
          confirmationNumber: result.value.confirmationNumber,
          speak: escalationAcknowledgementVoice(formatConfirmationForSpeech(result.value.confirmationNumber)),
        },
        intakePatch: { confirmationNumber: result.value.confirmationNumber },
      };
    }

    case "add_note_to_service_request": {
      const rawConfirmation = str(input.confirmationNumber).toUpperCase();
      const note = str(input.note).slice(0, 400);
      if (!agencyId || !rawConfirmation || !note) {
        return { ok: false, toolName: "add_note_to_service_request", payload: { error: "missing_params" } };
      }
      const updated = await callAssistStore.appendCaseInformation({
        agencyId,
        confirmationNumber: rawConfirmation,
        note,
        updatedBy: "RESIDENT_VOICE",
      }).catch(() => null);
      const spokenConf = formatConfirmationForSpeech(rawConfirmation);
      return {
        ok: Boolean(updated),
        toolName: "add_note_to_service_request",
        payload: {
          saved: Boolean(updated),
          speak: updated
            ? `I've added that information to your report ${spokenConf}. Is there anything else I can help you with?`
            : `I wasn't able to add the note right now. The report ${spokenConf} is on file. Please try again or call back.`,
        },
        intakePatch: updated ? { confirmationNumber: updated.confirmationNumber } : undefined,
      };
    }

    default:
      return null;
  }
}

/** Keyword interrupt before tools — same Safety + extra phrases as shared consumeNovaSonicOutput. */
export function emergencyHandoffFromTranscript(transcript: string): Partial<NovaSonicConnectHandoffAttrs> | null {
  const hit = checkEmergencyKeywords(transcript);
  if (!hit) return null;
  return {
    emergencyEscalation: "true",
    callerDone: "false",
    novaSonicFallbackToLex: "false",
    novaSessionStatus: "EMERGENCY",
    escalationAnnouncement: "I'm transferring you to emergency services now.",
    novaFallbackReason: hit,
  };
}

export function mergeHandoff(
  base: NovaSonicConnectHandoffAttrs,
  patch?: Partial<NovaSonicConnectHandoffAttrs>,
): NovaSonicConnectHandoffAttrs {
  if (!patch) return base;
  return { ...base, ...patch };
}

export function initialHandoff(): NovaSonicConnectHandoffAttrs {
  return emptyNovaSonicConnectHandoffAttrs();
}

export function fallbackHandoff(reason: string): NovaSonicConnectHandoffAttrs {
  return emptyNovaSonicConnectHandoffAttrs({
    novaSonicFallbackToLex: "true",
    novaSessionStatus: "FALLBACK",
    novaFallbackReason: reason.slice(0, 180),
  });
}
