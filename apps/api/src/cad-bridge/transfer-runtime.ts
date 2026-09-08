import type { BridgeEvent, CADBridgeConfig, CanonicalIncident } from "rapid-cortex-shared";
import {
  acceptIncidentTransfer,
  cancelIncidentTransfer,
  CadBridgeTransferError,
  requestIncidentTransfer,
} from "rapid-cortex-shared";

export function applyTransferEvent(
  incident: CanonicalIncident,
  event: BridgeEvent,
  config: CADBridgeConfig,
): CanonicalIncident {
  const nowIso = new Date().toISOString();
  try {
    if (event.eventType === "TRANSFER_REQUESTED") {
      return requestIncidentTransfer({
        incident,
        requestedBy: "CAD",
        toSlot: event.sourceSlot === incident.owner ? (incident.owner === "CAD_A" ? "CAD_B" : "CAD_A") : event.sourceSlot,
        nowIso,
        timeoutSeconds: config.transferTimeoutSeconds,
      });
    }
    if (event.eventType === "TRANSFER_ACCEPTED") {
      return acceptIncidentTransfer({ incident, acceptedBy: "CAD", nowIso });
    }
    if (event.eventType === "TRANSFER_CANCELLED") {
      return cancelIncidentTransfer({ incident, nowIso });
    }
  } catch (err) {
    if (err instanceof CadBridgeTransferError) {
      console.warn("[cad-bridge.transfer] ignored invalid transfer event", { message: err.message });
      return incident;
    }
    throw err;
  }
  return incident;
}
