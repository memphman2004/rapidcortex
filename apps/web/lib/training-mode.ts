/**
 * Copy for when the browser has no API target (`NEXT_PUBLIC_AUTH_PROXY=1` + proxy upstream,
 * or `NEXT_PUBLIC_API_BASE`). Dispatch UI uses local sample incidents only — not live agency data.
 */
export const TRAINING_MODE_LABEL = "Training mode";

export const TRAINING_MODE_PUBLIC_API_ENV = "NEXT_PUBLIC_API_BASE";

export const TRAINING_MODE_API_EXPLANATION = `API is not configured (no auth proxy or ${TRAINING_MODE_PUBLIC_API_ENV}). The queue uses local sample incidents only — not for live dispatch.`;

export function trainingModeBannerPlainText(): string {
  return `${TRAINING_MODE_LABEL}. ${TRAINING_MODE_API_EXPLANATION}`;
}

/** Split around `NEXT_PUBLIC_API_BASE` so UI can wrap the env var in `<code>`. */
export function trainingModeExplanationParts(): [string, string] {
  const parts = TRAINING_MODE_API_EXPLANATION.split(TRAINING_MODE_PUBLIC_API_ENV);
  if (parts.length === 2 && parts[0] !== undefined && parts[1] !== undefined) {
    return [parts[0], parts[1]];
  }
  return [TRAINING_MODE_API_EXPLANATION, ""];
}

/** Top bar / Connections strip tooltips. */
export function trainingModeCompactDetail(): string {
  return trainingModeBannerPlainText();
}
