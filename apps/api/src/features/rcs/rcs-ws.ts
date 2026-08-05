import type { RcsWebSocketEvent } from "rapid-cortex-shared";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";

/** Publish an RCS intelligence WS event to the agency connection group. */
export async function publishRcsEvent(event: RcsWebSocketEvent): Promise<void> {
  const agencyId =
    "agencyId" in event
      ? event.agencyId
      : "snapshot" in event
        ? event.snapshot.agencyId
        : "";
  if (!agencyId) return;
  const { type, ...rest } = event;
  try {
    await broadcastToAgency({
      agencyId,
      message: { type, data: rest as unknown as Record<string, unknown> },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rcs_ws_publish_failed",
        type,
        agencyId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
