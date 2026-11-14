import type { EventBridgeEvent, Handler } from "aws-lambda";
import { env } from "../lib/env.js";
import { preArrivalService } from "./preArrivalService.js";

interface CadSessionOpenDetail {
  incidentId?: string;
  agencyId?: string;
  callerANI?: string;
  natureCode?: string;
  incidentAddress?: string;
  /** Legacy CAD field aliases accepted when canonical names are absent. */
  cadNatureCode?: string;
  callerPhoneE164?: string | null;
}

type CadSessionOpenResult =
  | { opened: false; reason: "pre_arrival_disabled" }
  | { opened: false; reason: "missing_required_fields"; missing: string[] }
  | { opened: false; reason: "restricted" }
  | Awaited<ReturnType<typeof preArrivalService.createFromCad>>;

/**
 * Opens a Pre-Arrival session when CAD publishes incident.created / unit.dispatched /
 * dispatch.unit_assigned on bus nexcortiq.cad.
 */
export const handler: Handler<EventBridgeEvent<string, CadSessionOpenDetail>, CadSessionOpenResult> = async (
  event,
) => {
  if (!env.enablePreArrivalIq) return { opened: false, reason: "pre_arrival_disabled" };

  const detail = event.detail ?? {};
  const natureCode = detail.natureCode ?? detail.cadNatureCode;
  const callerANI = detail.callerANI ?? detail.callerPhoneE164 ?? undefined;
  const incidentAddress = detail.incidentAddress;

  const required: Record<string, string | null | undefined> = {
    incidentId: detail.incidentId,
    agencyId: detail.agencyId,
    callerANI,
    natureCode,
    incidentAddress,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value == null || String(value).trim() === "")
    .map(([key]) => key);

  if (missing.length > 0) {
    // Log field names only — never raw ANI / address values.
    console.warn(
      JSON.stringify({
        type: "cad.session_open.invalid_event",
        missing,
        incidentId: detail.incidentId ?? null,
        agencyId: detail.agencyId ?? null,
        detailType: event["detail-type"],
      }),
    );
    return { opened: false, reason: "missing_required_fields", missing };
  }

  try {
    return await preArrivalService.createFromCad({
      incidentId: detail.incidentId as string,
      agencyId: detail.agencyId as string,
      cadNatureCode: natureCode as string,
      callerPhoneE164: callerANI as string,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "PRE_ARRIVAL_RESTRICTED") return { opened: false, reason: "restricted" };
    console.error(JSON.stringify({ type: "pre_arrival.cad_open.error", message }));
    throw err;
  }
};
