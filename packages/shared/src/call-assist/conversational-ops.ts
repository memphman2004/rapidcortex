/**
 * Operational polish for Nexiq conversational voice: QA cohort tags,
 * staging traffic split, and transfer screen-pop enrichment.
 * Does not replace Safety Engine or Nova orchestration.
 */

/** Contact / Lex attribute used to filter recordings and CTR exports. */
export const NEXCORTIQ_CONVERSATIONAL_QA_TAG = "NexCortIQ-Conversational-v2";

/** Share of non-emergency starts routed to the staging conversational cohort. */
export const CONVERSATIONAL_STAGING_TRAFFIC_PERCENT = 5;

/** Minimum staging calls before promoting conversational tuning agency-wide. */
export const CONVERSATIONAL_STAGING_MIN_CALLS = 500;

export type ConversationalCohort = "staging" | "production";

export type TransferSummaryInput = {
  utterance: string;
  slots: Record<string, string | null | undefined>;
  agencyShortName: string;
  /** emergency | human_request | low_confidence | complexity | other */
  transferReason?: string;
  language?: string;
  turnCount?: number;
  /** Pipe transcript (`Caller: …|Assistant: …`) used when turnCount is omitted. */
  transcript?: string;
  callerName?: string;
  locationOverride?: string;
};

/** Stable 0–99 bucket from contact/session id for percentage traffic splits. */
export function conversationalTrafficBucket(contactOrSessionId: string): number {
  const raw = contactOrSessionId.trim();
  if (!raw) return 0;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function assignConversationalCohort(
  contactOrSessionId: string,
  stagingPercent: number = CONVERSATIONAL_STAGING_TRAFFIC_PERCENT,
): ConversationalCohort {
  const pct = Math.max(0, Math.min(100, Math.floor(stagingPercent)));
  if (pct <= 0) return "production";
  return conversationalTrafficBucket(contactOrSessionId) < pct ? "staging" : "production";
}

export function countCallerTurns(transcript: string | undefined | null): number {
  if (!transcript?.trim()) return 0;
  return transcript
    .split("|")
    .map((part) => part.trim())
    .filter((part) => /^caller:/i.test(part)).length;
}

function slotValue(slots: TransferSummaryInput["slots"], ...keys: string[]): string {
  for (const key of keys) {
    const value = slots[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Dispatcher screen-pop / CTR transfer summary.
 * Keep one short block — readable on a radio/CAD pop without scrolling.
 */
export function buildConversationalTransferSummary(input: TransferSummaryInput): string {
  const agency = input.agencyShortName.trim() || "Agency";
  const location =
    input.locationOverride?.trim() ||
    slotValue(
      input.slots,
      "ServiceAddress",
      "NoiseLocation",
      "location",
      "Location",
      "address",
      "Address",
    ) ||
    "Not provided";
  const incidentType =
    slotValue(input.slots, "incidentType", "IncidentType", "SubIssue", "IssueDescription", "NoiseType") ||
    "Not specified";
  const callerName =
    input.callerName?.trim() ||
    slotValue(input.slots, "CallerName", "callerName", "Name") ||
    "Not provided";
  const reason = (input.transferReason ?? "emergency").trim() || "emergency";
  const language = (input.language ?? "en").trim() || "en";
  const turns =
    typeof input.turnCount === "number" && Number.isFinite(input.turnCount)
      ? Math.max(0, Math.floor(input.turnCount))
      : countCallerTurns(input.transcript);
  const clipped = input.utterance.trim().slice(0, 120);

  const lines = [
    `${agency} Nexiq transfer`,
    `Type: ${incidentType}`,
    `Address: ${location}`,
    `Caller: ${callerName}`,
    `Language: ${language}`,
    `Turns: ${turns}`,
    `Reason: ${reason}`,
  ];
  if (clipped) lines.push(`Last: "${clipped}"`);
  lines.push("Full transcript in contact attributes.");
  return lines.join(" | ");
}
