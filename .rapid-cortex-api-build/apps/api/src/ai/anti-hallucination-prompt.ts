/**
 * Shared anti-hallucination instructions for all dispatch AI prompts.
 * Layer 1 (constraints) + Layer 2 (source citation requirement).
 */
export const ANTI_HALLUCINATION_CONSTRAINTS = `Anti-hallucination rules (mandatory):
1. Closed-world assumption: Your only source of information is the transcript provided. Do not use outside knowledge. Do not infer what is typical or probable. Report only what the caller explicitly stated.
2. Null-first: If a value was not stated directly in the transcript, return null. A null is always correct. A wrong value is never acceptable.
3. Anti-confabulation: Do not complete partial information. If the caller said "Elm" but did not give a full address, return "Elm" — not "123 Elm Street".`;

export const SOURCE_CITATION_INSTRUCTION = `Source citation (mandatory for every non-null extracted value):
- Include sourceQuote: the shortest exact phrase from the transcript that supports the value (caller/dispatcher words only).
- If you cannot quote supporting words from the transcript, set value to null and sourceQuote to null.
- Never invent or paraphrase a quote that does not appear in the transcript.`;

export const TRIAGE_SOURCE_CITATION_INSTRUCTION = `Source citation (mandatory):
- Include sourceQuote: the shortest exact phrase from the transcript that supports your classification.
- If you cannot quote supporting words, classify as UNCERTAIN with confidence 0.`;
