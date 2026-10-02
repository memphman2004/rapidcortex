/**
 * Attach buying-intelligence fields (pre-RFP taxonomy) onto a pipeline signal.
 * Deterministic classifiers — no automatic Lead / Pipeline promotion.
 */

import {
  classifyBuyingIntelligence,
  type RapidIqPipelineSignal,
  type RapidIqProcurementStage,
} from "rapid-cortex-shared";

export function applyBuyingIntelligence(input: {
  title: string;
  text: string;
  sourceUrl?: string;
  agencyName?: string;
  state?: string;
  procurementStage?: RapidIqProcurementStage;
}): Pick<
  RapidIqPipelineSignal,
  | "buyingStage"
  | "signalStrength"
  | "buyingSignalType"
  | "signalCategory"
  | "primaryVertical"
  | "verticals"
  | "matchedCapabilities"
  | "painPoints"
  | "facts"
  | "inferences"
  | "competitors"
  | "priorityBand"
  | "priorityReasons"
  | "correlationKey"
  | "techCategory"
> {
  const intel = classifyBuyingIntelligence({
    title: input.title,
    text: input.text,
    sourceUrl: input.sourceUrl,
    agencyName: input.agencyName,
    state: input.state,
    procurementStage: input.procurementStage,
  });

  return {
    buyingStage: intel.buyingStage,
    signalStrength: intel.signalStrength,
    buyingSignalType: intel.buyingSignalType,
    signalCategory: intel.signalCategory,
    primaryVertical: intel.primaryVertical,
    verticals: intel.verticals,
    matchedCapabilities: intel.matchedCapabilities,
    painPoints: intel.painPoints,
    facts: intel.facts,
    inferences: intel.inferences,
    competitors: intel.competitors,
    priorityBand: intel.priorityBand,
    priorityReasons: intel.priorityReasons,
    correlationKey: intel.correlationKey,
    techCategory: intel.techCategory,
  };
}
