/**
 * Lex dialog-hook wrapper around the deterministic Safety engine.
 * Runs on every turn before NLU, Bedrock, or slot elicitation.
 * No config flag, intent, or model can suppress TRANSFER_911.
 */
import { evaluateSafety, isImmutableEmergency } from "rapid-cortex-shared";

export type SafetyResult = {
  isEmergency: boolean;
  triggerWord: string | null;
  summary: string;
};

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
): string {
  const location = slots.location ?? slots.building ?? slots.section ?? "unknown location";
  const type = slots.incidentType ?? "emergency";
  const clipped = utterance.slice(0, 120);
  return (
    `${agencyShortName} Call Assist. ` +
    `Emergency escalation from non-emergency line. ` +
    `Caller at ${location} reported: ${type}. ` +
    `Last utterance: "${clipped}". ` +
    `Full transcript in contact attributes.`
  );
}
