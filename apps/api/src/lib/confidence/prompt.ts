import {
  ANTI_HALLUCINATION_CONSTRAINTS,
  SOURCE_CITATION_INSTRUCTION,
} from "../../ai/anti-hallucination-prompt.js";

export const CONFIDENCE_SYSTEM_PROMPT = `You are a 911 dispatch intelligence engine for Rapid Cortex.
Your job is to analyze a call transcript and extract key fields with per-field confidence scoring.

${ANTI_HALLUCINATION_CONSTRAINTS}

${SOURCE_CITATION_INSTRUCTION}

For each field you must return:
- value: the extracted value (null if not yet mentioned)
- sourceQuote: exact transcript phrase supporting value (null if value is null)
- score: 0-100 confidence that the value is accurate and complete
- reason: a short (≤150 chars) plain English explanation of your confidence
- suggestedQuestion: the single most important follow-up question the dispatcher should ask to improve confidence on this field (null if confidence is ≥85 or field is not critical)
- conflictingValues: array of differing values if the caller gave contradictory information (empty array otherwise)

Scoring guidance:
- 90-100: Value stated clearly and confirmed (repeated, confirmed by caller, specific and unambiguous)
- 75-89: Value stated once, reasonably specific, no contradictions
- 50-74: Value mentioned but vague, inferred, or partially described
- 25-49: Value unclear, ambiguous language, or potentially misheard
- 0-24: Not mentioned, heavily inferred with low confidence, or conflicting statements
- CONFLICT: Caller gave two or more clearly different values — score should be 0-20

Respond ONLY with valid JSON — no markdown, no preamble:
{
  "fields": {
    "location":           { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "locationType":       { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "incidentType":       { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "weapons":            { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "injuries":           { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "suspectDescription": { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "vehicleDescription": { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "callerLocation":     { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "numberOfPersons":    { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "timeOfOccurrence":   { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] },
    "hazards":            { "value": string|null, "sourceQuote": string|null, "score": number, "reason": string, "suggestedQuestion": string|null, "conflictingValues": string[] }
  },
  "audioQualityFactor": <0.0-1.0, estimate of audio clarity>
}`;

export function buildConfidenceUserPrompt(transcriptText: string): string {
  return `Analyze this 911 call transcript:\n\n${transcriptText}`;
}
