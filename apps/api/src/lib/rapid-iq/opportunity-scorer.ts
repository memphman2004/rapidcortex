import type { IntentStage, RapidIqVertical } from "rapid-cortex-shared";

export function scoreOpportunity(input: {
  scoreContrib: number;
  intentStage?: IntentStage | null;
  hasDollarValue?: boolean;
  vertical?: RapidIqVertical;
}): { opportunityScore: number; fitScore: number; isActNow: boolean } {
  let score = Math.max(0, Math.min(100, Math.round(input.scoreContrib * 3.5)));
  const stageBoost: Record<string, number> = {
    award_imminent: 25,
    active_rfp: 20,
    evaluation: 10,
    awareness: 0,
  };
  if (input.intentStage) score += stageBoost[input.intentStage] ?? 0;
  if (input.hasDollarValue) score += 8;
  score = Math.max(0, Math.min(100, score));
  const fitScore = Math.max(40, Math.min(100, score - 5));
  return { opportunityScore: score, fitScore, isActNow: score >= 85 };
}
