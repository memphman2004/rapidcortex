import type { Handler } from "aws-lambda";
import { cadIngestionService } from "rapid-cortex-integrations/cad";
import { cadConnectorEnabled } from "./cadConnectorFlag.js";

/** EventBridge-invoked polling loop — honors per-connector interval (min 30s) via lastSyncAt. */
export const handler: Handler = async () => {
  if (!cadConnectorEnabled()) {
    return { skipped: true, reason: "disabled" };
  }
  const results = await cadIngestionService.pollDueConnectors();
  return { ran: results.length, results };
};
