import type { TranscriptSegment } from "../types.js";
import { DEFAULT_PROTOCOL_PACKS } from "./defaultPacks.js";
import type { ProtocolGuidance, ProtocolPack, ProtocolStep } from "./types.js";

export const PROTOCOL_COACH_DISCLAIMER =
  "Guidance shown here is from your agency-approved protocol pack. You remain the decision-maker — use, adapt, or set aside phrases to fit policy, training, and scene conditions. This tool does not diagnose and does not replace medical direction from your agency.";

function flattenTranscript(transcript: TranscriptSegment[]): string {
  return transcript.map((s) => s.text).join(" ");
}

/** Packs visible for an agency and locale (defaults apply to all agencies when agencyIds omitted). */
export function resolveProtocolPacks(
  agencyId: string,
  locale = "en",
  packs: ProtocolPack[] = DEFAULT_PROTOCOL_PACKS,
): ProtocolPack[] {
  const lang = locale.split("-")[0] ?? "en";
  return packs.filter((p) => {
    if (p.locale !== locale && !(lang === "en" && p.locale === "en")) return false;
    if (p.agencyIds && p.agencyIds.length > 0 && !p.agencyIds.includes(agencyId)) return false;
    return true;
  });
}

/**
 * Pick the best-matching protocol pack from approved content only (keyword scoring).
 */
export function identifyProtocol(
  transcriptText: string,
  packs: ProtocolPack[],
): ProtocolPack | null {
  const t = transcriptText.toLowerCase();
  let best: ProtocolPack | null = null;
  let bestScore = 0;
  for (const pack of packs) {
    let score = 0;
    for (const kw of pack.identificationKeywords) {
      if (t.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = pack;
    }
  }
  if (!best || bestScore < 1) return null;
  return best;
}

function inferStepIndex(transcriptText: string, pack: ProtocolPack): number {
  const t = transcriptText.toLowerCase();
  let idx = 0;
  for (let i = 0; i < pack.steps.length; i++) {
    const step = pack.steps[i];
    const when = step?.advanceWhen;
    if (when?.some((w) => t.includes(w.toLowerCase()))) {
      idx = i + 1;
    }
  }
  return Math.min(idx, Math.max(0, pack.steps.length - 1));
}

/**
 * Current step object and index after simple progression inference from transcript.
 */
export function getCurrentProtocolStep(
  pack: ProtocolPack,
  transcriptText: string,
): { step: ProtocolStep; index: number } {
  const index = inferStepIndex(transcriptText, pack);
  const step = pack.steps[index] ?? pack.steps[0];
  if (!step) {
    throw new Error("Protocol pack has no steps");
  }
  return { step, index };
}

/** Suggested line for the dispatcher — always taken verbatim from protocol content. */
export function getSuggestedHumanPhrase(step: ProtocolStep): string {
  return step.dispatcherPhrase;
}

export function getEscalationRules(pack: ProtocolPack, step: ProtocolStep): {
  stepEscalation: string;
  protocolEscalation: string;
} {
  return {
    stepEscalation: step.escalationCriteria,
    protocolEscalation: pack.protocolEscalationSummary,
  };
}

/** One-line summary for UI headers and audit (no free-form model text). */
export function getProtocolSummary(pack: ProtocolPack, step: ProtocolStep): string {
  return `${pack.name} · Step ${step.order}: ${step.title}`;
}

/**
 * Build attachable protocol guidance for an analysis record. Returns undefined when no pack matches.
 */
export function buildProtocolGuidance(
  transcript: TranscriptSegment[],
  agencyId: string,
  locale = "en",
  packs: ProtocolPack[] = DEFAULT_PROTOCOL_PACKS,
): ProtocolGuidance | undefined {
  const text = flattenTranscript(transcript);
  const resolved = resolveProtocolPacks(agencyId, locale, packs);
  const pack = identifyProtocol(text, resolved);
  if (!pack) return undefined;

  const { step } = getCurrentProtocolStep(pack, text);
  const phrase = getSuggestedHumanPhrase(step);
  const { stepEscalation, protocolEscalation } = getEscalationRules(pack, step);

  return {
    protocolId: pack.id,
    protocolName: pack.name,
    category: pack.category,
    locale: pack.locale,
    currentStepId: step.id,
    currentStepOrder: step.order,
    currentStepTitle: step.title,
    recommendedPhrase: phrase,
    rationale: step.rationale,
    escalationCriteria: `${stepEscalation} ${protocolEscalation}`.trim(),
    protocolEscalationSummary: protocolEscalation,
    coachDisclaimer: PROTOCOL_COACH_DISCLAIMER,
  };
}
