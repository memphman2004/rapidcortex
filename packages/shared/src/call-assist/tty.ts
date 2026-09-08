/**
 * TTY/TDD is a telephony capability, not a Safety Engine concern.
 * Baudot hardware detection is provider-specific; this module only classifies signals.
 */

export type TtyDetectionSource = "CONNECT_ATTRIBUTE" | "MEDIA_TYPE" | "SMS_FALLBACK" | "MANUAL";

export type TtyDetection = {
  ttyMode: boolean;
  source: TtyDetectionSource;
  smsFallbackRecommended: boolean;
};

export function detectTtyMode(input: {
  connectAttributes?: Record<string, string>;
  mediaType?: string;
  manualTty?: boolean;
}): TtyDetection {
  if (input.manualTty) {
    return { ttyMode: true, source: "MANUAL", smsFallbackRecommended: true };
  }
  const media = (input.mediaType ?? "").toLowerCase();
  if (media.includes("tty") || media.includes("baudot") || media.includes("tdd")) {
    return { ttyMode: true, source: "MEDIA_TYPE", smsFallbackRecommended: true };
  }
  const attrs = input.connectAttributes ?? {};
  const joined = Object.values(attrs).join(" ").toLowerCase();
  if (/\b(tty|tdd|baudot)\b/.test(joined)) {
    return { ttyMode: true, source: "CONNECT_ATTRIBUTE", smsFallbackRecommended: true };
  }
  return { ttyMode: false, source: "CONNECT_ATTRIBUTE", smsFallbackRecommended: false };
}
