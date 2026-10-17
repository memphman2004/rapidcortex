import type { EventBridgeEvent, Handler } from "aws-lambda";
import type { IncidentUpdatedEvent } from "rapid-cortex-shared";
import { ProtocolReconciliationEngine } from "./engine.js";
import { env } from "../../lib/env.js";

interface CadIncidentUpdatedDetail {
  incidentId: string;
  agencyId: string;
  dispatcherId?: string;
  timestamp: string;
  source?: string;
  changes?: {
    natureCode?: { prior: string; current: string };
  };
  priorNatureCode?: string;
  newNatureCode?: string;
}

const engine = new ProtocolReconciliationEngine();

export const handler: Handler<EventBridgeEvent<string, CadIncidentUpdatedDetail>> = async (event) => {
  if (!env.enablePreArrivalIq) {
    return { processed: false, reason: "pre_arrival_disabled" };
  }

  const detail = event.detail;
  let prior = detail.changes?.natureCode?.prior ?? detail.priorNatureCode;
  let current = detail.changes?.natureCode?.current ?? detail.newNatureCode;
  if (!prior || !current || prior === current) {
    return { processed: false, reason: "no_nature_code_change" };
  }

  const payload: IncidentUpdatedEvent = {
    incidentId: detail.incidentId,
    agencyId: detail.agencyId,
    dispatcherId: detail.dispatcherId ?? "system:cad",
    priorNatureCode: prior,
    newNatureCode: current,
    timestamp: detail.timestamp || new Date().toISOString(),
    source: detail.source ?? event.source ?? "cad",
  };

  try {
    const result = await engine.reconcile(payload);
    return {
      processed: Boolean(result),
      sessionTerminated: result?.sessionTerminated ?? false,
      sessionToken: result?.sessionToken,
    };
  } catch (err) {
    console.error(JSON.stringify({ type: "pre_arrival.reconcile.error", err: String(err) }));
    throw err;
  }
};
