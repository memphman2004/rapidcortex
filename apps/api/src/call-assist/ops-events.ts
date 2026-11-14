/**
 * Optional EventBridge publish for Call Assist ops.
 * No-op when CALL_ASSIST_EVENT_BUS_NAME is unset — preserves live path without the bus.
 */
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  CALL_ASSIST_DETAIL_TYPES,
  CALL_ASSIST_EVENT_BUS_NAME_ENV,
  CALL_ASSIST_EVENT_SOURCE,
  type CallAssistDetailType,
} from "rapid-cortex-shared";

const eb = new EventBridgeClient({});

export async function publishCallAssistOpsEvent(opts: {
  detailType: CallAssistDetailType;
  agencyId: string;
  sessionId?: string;
  detail?: Record<string, unknown>;
}): Promise<{ published: boolean; reason?: string }> {
  const busName = process.env[CALL_ASSIST_EVENT_BUS_NAME_ENV]?.trim();
  if (!busName) {
    return { published: false, reason: "bus_unset" };
  }
  try {
    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: CALL_ASSIST_EVENT_SOURCE,
            DetailType: opts.detailType,
            Detail: JSON.stringify({
              agencyId: opts.agencyId,
              sessionId: opts.sessionId,
              ...opts.detail,
            }),
          },
        ],
      }),
    );
    return { published: true };
  } catch (err) {
    console.warn(
      JSON.stringify({
        msg: "call_assist_ops_event_publish_failed",
        detailType: opts.detailType,
        agencyId: opts.agencyId,
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return { published: false, reason: "publish_error" };
  }
}

export async function publishEmergencyEscalation(opts: {
  agencyId: string;
  sessionId?: string;
  matchedPhrases?: string[];
}): Promise<void> {
  await publishCallAssistOpsEvent({
    detailType: CALL_ASSIST_DETAIL_TYPES.EmergencyEscalation,
    agencyId: opts.agencyId,
    sessionId: opts.sessionId,
    detail: { matchedPhrases: opts.matchedPhrases ?? [] },
  });
}

export async function publishNovaSonicFallback(opts: {
  agencyId: string;
  sessionId?: string;
  reason?: string;
}): Promise<void> {
  await publishCallAssistOpsEvent({
    detailType: CALL_ASSIST_DETAIL_TYPES.NovaSonicFallback,
    agencyId: opts.agencyId,
    sessionId: opts.sessionId,
    detail: { reason: opts.reason },
  });
}
