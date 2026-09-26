/**
 * EventBridge every-minute handler — escalate expired responder check-in timers.
 *
 * Delegates to feature-suite `escalateExpiredCheckInTimers`:
 * - Queries CheckinTable expiry-index (GSI) per ACTIVE_AGENCY_IDS
 * - 3-tier escalation (supervisor_alert → backup_dispatch → emergency_response)
 * - SNS publish with MessageAttributes (agencyId, unitId, escalationLevel, …)
 * - Conditional update prevents double-escalation races
 * - Panic alert record at emergency_response
 * - WebSocket CHECKIN_EXPIRED broadcast (no-op if WS env unset)
 */

import type { ScheduledHandler } from "aws-lambda";
import { isFeaturesSuiteEnabled } from "../../feature-suite/tables.js";
import { escalateExpiredCheckInTimers } from "../../feature-suite/training-predictive-safety.js";

export const handler: ScheduledHandler = async () => {
  if (!isFeaturesSuiteEnabled()) {
    console.info("[features/checkin-expiry] suite disabled — skipping");
    return;
  }
  console.info("[features/checkin-expiry] scanning expired timers");
  const result = await escalateExpiredCheckInTimers();
  console.info("[features/checkin-expiry] done", result);
};
