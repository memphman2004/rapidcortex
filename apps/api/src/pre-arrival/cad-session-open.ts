import type { EventBridgeEvent, Handler } from "aws-lambda";
import { env } from "../lib/env.js";
import { preArrivalService } from "./preArrivalService.js";

interface CadSessionOpenDetail {
  incidentId?: string;
  agencyId?: string;
  cadNatureCode?: string;
  callerPhoneE164?: string | null;
}

/** Opens a Pre-Arrival session when CAD publishes incident.created or unit.dispatched. */
export const handler: Handler<EventBridgeEvent<string, CadSessionOpenDetail>> = async (event) => {
  if (!env.enablePreArrivalIq) return { opened: false, reason: "pre_arrival_disabled" };
  const detail = event.detail ?? {};
  if (!detail.incidentId || !detail.agencyId) return { opened: false, reason: "invalid_event" };
  try {
    return await preArrivalService.createFromCad({
      incidentId: detail.incidentId,
      agencyId: detail.agencyId,
      cadNatureCode: detail.cadNatureCode,
      callerPhoneE164: detail.callerPhoneE164,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PRE_ARRIVAL_RESTRICTED") return { opened: false, reason: "restricted" };
    console.error(JSON.stringify({ type: "pre_arrival.cad_open.error", message }));
    throw err;
  }
};
