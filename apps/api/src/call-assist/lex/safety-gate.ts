/**
 * Lex dialog-hook wrapper around the deterministic Safety engine.
 * Runs on every turn before NLU, Bedrock, or slot elicitation.
 * No config flag, intent, or model can suppress TRANSFER_911.
 */
import {
  buildConversationalTransferSummary,
  countCallerTurns,
  evaluateSafety,
  isImmutableEmergency,
} from "rapid-cortex-shared";
import { locationFromSlotMap } from "./dialog-intercept.js";

export type SafetyResult = {
  isEmergency: boolean;
  triggerWord: string | null;
  summary: string;
};

export type BuildTransferSummaryOpts = {
  transferReason?: string;
  language?: string;
  turnCount?: number;
  transcript?: string;
  callerName?: string;
};

/** Normalize Connect/Lex TransferReason enums for the dispatcher pop. */
export function transferSummaryReasonLabel(reason: string | undefined | null): string {
  const raw = (reason ?? "emergency").trim();
  return raw ? raw.toLowerCase() : "emergency";
}

/** Caller lines only, so the greeting's mention of 911 does not become a transfer. */
export function callerTextForSafety(transcript: string, utterance: string): string {
  const prior = transcript
    .split("|")
    .map((part) => part.trim())
    .filter((part) => /^caller:/i.test(part))
    .map((part) => part.replace(/^caller:\s*/i, ""));
  return [...prior, utterance].filter(Boolean).join(" ");
}

export function runSafetyGate(utterance: string): SafetyResult {
  const result = evaluateSafety(utterance);
  const emergency = isImmutableEmergency(result) || result.action === "TRANSFER_911";
  return {
    isEmergency: emergency,
    triggerWord: result.matchedPhrases[0] ?? null,
    summary: emergency
      ? "Emergency detected. Transferring now."
      : "Continue non-emergency intake.",
  };
}

export function buildTransferSummary(
  utterance: string,
  slots: Record<string, string | null>,
  agencyShortName: string,
  opts: BuildTransferSummaryOpts = {},
): string {
  const location = locationFromSlotMap(slots);
  // locationFromSlotMap returns a sentinel when Lex location slots are empty;
  // omit override so conversational-ops can still read ServiceAddress / Address.
  const locationOverride = location === "unknown location" ? undefined : location;
  const turnCount =
    opts.turnCount ??
    (opts.transcript ? countCallerTurns(opts.transcript) : countCallerTurns(`Caller: ${utterance}`));
  return buildConversationalTransferSummary({
    utterance,
    slots,
    agencyShortName,
    transferReason: opts.transferReason ?? "emergency",
    language: opts.language,
    turnCount,
    transcript: opts.transcript,
    callerName: opts.callerName,
    locationOverride,
  });
}
