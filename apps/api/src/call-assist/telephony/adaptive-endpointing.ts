/**
 * Adaptive end-of-speech silence for Lex V2 / Connect.
 * Session attribute `x-amz-lex:audio:end-timeout-ms` controls how long Lex
 * waits after the caller stops speaking before ending the turn.
 *
 * Spec Phase 2: tolerate hesitation / mid-correction; stay snappy for short
 * confident answers. Never so short that natural pauses cut the caller off.
 */

export type EndpointingProfile = "snappy" | "default" | "patient" | "correction";

export type AdaptiveEndpointingInput = {
  utterance: string;
  /** Prior turn had a correction cue (wait / actually / I mean). */
  hadCorrectionCue?: boolean;
  /** Lex/Connect sentiment when available. */
  sentiment?: string | null;
  /** Accumulated barge-in count this call. */
  bargeInCount?: number;
  /** Session flag from mid-correction wait. */
  waitingForFinalValue?: boolean;
};

export type AdaptiveEndpointingResult = {
  profile: EndpointingProfile;
  /** Milliseconds of trailing silence before Lex ends the turn. */
  endTimeoutMs: number;
  sessionPatch: Record<string, string>;
};

const END_TIMEOUT: Record<EndpointingProfile, number> = {
  snappy: 500,
  default: 800,
  patient: 1400,
  correction: 1800,
};

const CORRECTION_CUE_RE =
  /\b(wait|actually|i mean|sorry[, ]|no[, ]+(?:it'?s|wait)|not (?:a |the )?|correction|hold on)\b/i;
const HESITATION_RE = /\b(um+|uh+|er+|hmm+|let me think|hang on|one (?:sec|second))\b/i;
const SHORT_ANSWER_RE = /^(yes|no|yeah|yep|nope|correct|right|okay|ok|sure)\b/i;

export function detectCorrectionCue(utterance: string): boolean {
  return CORRECTION_CUE_RE.test(utterance);
}

export function resolveEndpointingProfile(input: AdaptiveEndpointingInput): EndpointingProfile {
  const text = input.utterance.trim();
  if (input.hadCorrectionCue || input.waitingForFinalValue || detectCorrectionCue(text)) {
    return "correction";
  }
  const sentiment = (input.sentiment ?? "").toUpperCase();
  if (sentiment === "NEGATIVE" || HESITATION_RE.test(text)) {
    return "patient";
  }
  if ((input.bargeInCount ?? 0) >= 2) {
    // Frequent interrupters → give slightly more room so we don't cut them.
    return "patient";
  }
  if (text.length > 0 && text.length <= 24 && SHORT_ANSWER_RE.test(text)) {
    return "snappy";
  }
  if (text.length > 0 && text.length <= 40 && !text.includes(",") && !text.includes("—")) {
    return "snappy";
  }
  return "default";
}

export function applyAdaptiveEndpointing(input: AdaptiveEndpointingInput): AdaptiveEndpointingResult {
  const profile = resolveEndpointingProfile(input);
  const endTimeoutMs = END_TIMEOUT[profile];
  return {
    profile,
    endTimeoutMs,
    sessionPatch: {
      "x-amz-lex:audio:end-timeout-ms": String(endTimeoutMs),
      endpointingProfile: profile,
      endpointEndTimeoutMs: String(endTimeoutMs),
      ...(profile === "correction" || detectCorrectionCue(input.utterance)
        ? { waitingForFinalValue: "1" }
        : { waitingForFinalValue: "0" }),
    },
  };
}

export function readEndpointingState(sessionAttrs: Record<string, string>): {
  profile: EndpointingProfile;
  endTimeoutMs: number;
  waitingForFinalValue: boolean;
} {
  const profileRaw = sessionAttrs.endpointingProfile;
  const profile: EndpointingProfile =
    profileRaw === "snappy" || profileRaw === "patient" || profileRaw === "correction"
      ? profileRaw
      : "default";
  const parsed = Number.parseInt(
    sessionAttrs["x-amz-lex:audio:end-timeout-ms"] ?? sessionAttrs.endpointEndTimeoutMs ?? "",
    10,
  );
  return {
    profile,
    endTimeoutMs: Number.isFinite(parsed) ? parsed : END_TIMEOUT[profile],
    waitingForFinalValue: sessionAttrs.waitingForFinalValue === "1",
  };
}
