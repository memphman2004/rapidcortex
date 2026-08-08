/**
 * Copy for when the browser has no API target. Dispatch UI uses local sample
 * incidents only — not live agency data. Keep operator-facing strings free of env vars.
 */
export const TRAINING_MODE_LABEL = "Training mode";

export const TRAINING_MODE_API_EXPLANATION =
  "API isn’t connected — showing sample incidents only. Not for live dispatch.";

export function trainingModeBannerPlainText(): string {
  return `${TRAINING_MODE_LABEL}. ${TRAINING_MODE_API_EXPLANATION}`;
}

/** Top bar / Connections strip tooltips. */
export function trainingModeCompactDetail(): string {
  return "Training — sample data only";
}
