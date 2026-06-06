import { extractKeywords, SURGE_KEYWORDS } from "rapid-cortex-shared";
import type { CallType } from "../types/surge-types.js";

type SurgeKeywordCategory = keyof typeof SURGE_KEYWORDS;

export function callTypeToSurgeCategory(callType: CallType): SurgeKeywordCategory | undefined {
  switch (callType) {
    case "medical":
      return "medical";
    case "fire":
      return "fire";
    case "traffic":
      return "traffic";
    case "police":
      return "violence";
    default:
      return undefined;
  }
}

export function keywordsForCall(transcript: string, callType: CallType): string[] {
  const cat = callTypeToSurgeCategory(callType);
  return extractKeywords(transcript, cat);
}
