/**
 * Deterministic fit scoring for Rapid IQ procurement pipeline signals.
 * Tuned to RC win conditions: Tyler/Hexagon/CentralSquare new CAD + grant funding.
 */

import type {
  RapidIqPipelineExtraction,
  RapidIqPipelineFitLabel,
} from "rapid-cortex-shared";

const TARGET_VENDORS = ["tyler", "hexagon", "centralsquare", "motorola solutions"];
const AXON_VENDORS = ["axon", "prepared"];
const PUBLIC_SAFETY_AGENCY_TYPES = [
  "911",
  "ecc",
  "dispatch",
  "sheriff",
  "police",
  "fire",
  "ems",
  "emergency",
];
const GRANT_SOURCES = ["arpa", "cops", "state grant", "federal grant", "psap", "slfrf"];

function fitLabelFromScore(score: number): RapidIqPipelineFitLabel {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

export function computeFitScore(extraction: RapidIqPipelineExtraction): {
  score: number;
  label: RapidIqPipelineFitLabel;
  rationale: string[];
} {
  let score = 0;
  const rationale: string[] = [];

  const vendor = (extraction.vendorNamed ?? "").toLowerCase();
  const funding = (extraction.fundingSource ?? "").toLowerCase();
  const procType = extraction.procurementType ?? "unknown";
  const agencyType = (extraction.agencyType ?? "").toLowerCase();
  const amount = extraction.dollarAmount ?? 0;

  if (procType === "new-cad") {
    score += 30;
    rationale.push("+30: New CAD system — ideal AI layer introduction window");
  } else if (procType === "upgrade") {
    score += 15;
    rationale.push("+15: System upgrade — possible AI augmentation opportunity");
  } else if (procType === "ai-overlay") {
    score += 25;
    rationale.push("+25: Explicit AI overlay procurement — direct competitor signal");
  } else if (procType === "hardware") {
    score -= 20;
    rationale.push("-20: Hardware-only procurement — low RC fit");
  }

  if (TARGET_VENDORS.some((v) => vendor.includes(v))) {
    score += 20;
    rationale.push(`+20: Vendor is RC integration target (${extraction.vendorNamed})`);
  } else if (AXON_VENDORS.some((v) => vendor.includes(v))) {
    score -= 10;
    rationale.push("-10: Axon ecosystem — harder displacement");
  }

  if (GRANT_SOURCES.some((g) => funding.includes(g))) {
    score += 15;
    rationale.push("+15: Grant-funded — no general fund friction");
  }

  if (PUBLIC_SAFETY_AGENCY_TYPES.some((t) => agencyType.includes(t))) {
    score += 15;
    rationale.push("+15: Public safety agency type confirmed");
  }

  if (amount >= 40_000 && amount <= 500_000) {
    score += 10;
    rationale.push("+10: Dollar amount in RC pilot range ($40K–$500K)");
  } else if (amount > 500_000 && amount <= 3_000_000) {
    score += 8;
    rationale.push("+8: Dollar amount in RC enterprise range ($500K–$3M)");
  }

  if (!agencyType && !vendor && procType === "unknown") {
    score -= 40;
    rationale.push("-40: No public safety relevance detected");
  }

  const clamped = Math.max(0, Math.min(100, score));
  return { score: clamped, label: fitLabelFromScore(clamped), rationale };
}
