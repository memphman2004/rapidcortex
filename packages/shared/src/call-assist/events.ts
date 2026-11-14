/**
 * Call Assist ops event names for the optional `nexcortiq-call-assist-{stage}` bus.
 * Live voice path uses Connect attributes for Nova→Lex fallback; EventBridge is additive ops.
 */

export const CALL_ASSIST_EVENT_SOURCE = "nexcortiq.call-assist";

export const CALL_ASSIST_DETAIL_TYPES = {
  NovaSonicFallback: "NovaSonicFallback",
  EmergencyEscalation: "EmergencyEscalation",
  ServiceRequestCreated: "ServiceRequestCreated",
  SessionEnded: "SessionEnded",
} as const;

export type CallAssistDetailType =
  (typeof CALL_ASSIST_DETAIL_TYPES)[keyof typeof CALL_ASSIST_DETAIL_TYPES];

export type CallAssistOpsEvent = {
  detailType: CallAssistDetailType;
  agencyId: string;
  sessionId?: string;
  detail?: Record<string, unknown>;
};

/** Env var name for the optional ops bus (empty = no-op publishers). */
export const CALL_ASSIST_EVENT_BUS_NAME_ENV = "CALL_ASSIST_EVENT_BUS_NAME";
