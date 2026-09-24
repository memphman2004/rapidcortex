/**
 * EventBridge scheduled handler — nightly after-action learning analysis.
 * Isolates by ACTIVE_AGENCY_IDS; no user context.
 */

import type { ScheduledHandler } from "aws-lambda";
import { isFeaturesSuiteEnabled } from "../../feature-suite/tables.js";
import { runLearningAnalysisForAgencies } from "../../feature-suite/training-predictive-safety.js";

export const handler: ScheduledHandler = async () => {
  if (!isFeaturesSuiteEnabled()) {
    console.info("[features/learning-nightly] suite disabled — skipping");
    return;
  }
  console.info("[features/learning-nightly] starting");
  const result = await runLearningAnalysisForAgencies();
  console.info("[features/learning-nightly] done", result);
};
