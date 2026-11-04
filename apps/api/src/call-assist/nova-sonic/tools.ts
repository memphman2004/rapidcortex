/**
 * Nova Sonic tool handlers for Call Assist.
 * Tools update session state and produce Connect handoff attributes.
 */
import {
  checkEmergencyKeywords,
  emptyNovaSonicConnectHandoffAttrs,
  formatCallAssistCaseNumber,
  type NovaSonicConnectHandoffAttrs,
  type NovaSonicToolName,
} from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "../store.js";

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
