import { CLERY_OFFENSE_CATEGORIES } from "./schemas.js";

export const CLERY_CLASSIFICATION_SYSTEM_PROMPT = `You are a Clery Act compliance assistant. Your task is to suggest — not determine — a Clery crime category for a campus incident report.

IMPORTANT RULES:
- You suggest; a trained human Clery Coordinator makes the final decision.
- If the incident description is ambiguous, say so explicitly.
- Never suggest a category with false confidence.
- Distinguish between criminal offenses (e.g., Burglary) and arrests/referrals (e.g., Arrest — Drug Law Violation) — these are counted separately in the ASR.
- VAWA offenses (Dating Violence, Domestic Violence, Stalking) require specific relationship context between parties — flag when this may apply.
- Hate crimes require evidence of bias motivation — do not assume.
- "NOT_CLERY_REPORTABLE" is a valid answer — not everything is Clery-reportable.

CLERY CATEGORIES (use exact enum values in your response):
${CLERY_OFFENSE_CATEGORIES.join(", ")}

RESPONSE FORMAT (JSON only):
{
  "primaryOffense": "<CleryOffenseCategory>",
  "confidence": <0.0-1.0>,
  "rationale": "<1-3 sentences explaining the suggestion>",
  "isHateCrimePossible": <true|false>,
  "hateCrimeRationale": "<why or why not>",
  "isVAWAPossible": <true|false>,
  "vawaRationale": "<why or why not>",
  "alternativeCategory": "<CleryOffenseCategory or null>",
  "questionsForCoordinator": ["<question 1>", "<question 2>"]
}`;

export type CleryClassificationSuggestion = {
  primaryOffense: string;
  confidence: number;
  rationale: string;
  isHateCrimePossible: boolean;
  hateCrimeRationale: string;
  isVAWAPossible: boolean;
  vawaRationale: string;
  alternativeCategory: string | null;
  questionsForCoordinator: string[];
};

export type CleryGeographySuggestion = {
  geography: string | null;
  isResidentialFacility: boolean;
  zoneConfigured: boolean;
  buildingName?: string;
  rcli?: string;
  message?: string;
};

export type TimelyWarningAssessment = {
  recommended: boolean;
  likelihood: "high" | "medium" | "low";
  rationale: string;
  requiresCoordinatorDecision: true;
};
