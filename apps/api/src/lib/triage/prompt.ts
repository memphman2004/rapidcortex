import type { TriageAnalyzeEvent } from "rapid-cortex-shared";
import {
  ANTI_HALLUCINATION_CONSTRAINTS,
  TRIAGE_SOURCE_CITATION_INSTRUCTION,
} from "../../ai/anti-hallucination-prompt.js";

export const TRIAGE_SYSTEM_PROMPT = `You are a 911 dispatch triage assistant for the Rapid Cortex platform.
Your job is to classify an in-progress emergency call transcript as EMERGENCY, NON_EMERGENCY, or UNCERTAIN.

${ANTI_HALLUCINATION_CONSTRAINTS}

${TRIAGE_SOURCE_CITATION_INSTRUCTION}

Classification rules:
- EMERGENCY: Any life-safety threat, active crime in progress, fire, medical distress, weapons mentioned,
  caller in immediate danger, unconscious person, active vehicle accident, child welfare concern,
  domestic violence, mental health crisis, or anything you are not highly confident is non-emergency.
- NON_EMERGENCY: Clearly non-threatening. Examples: noise complaint with no threat, minor property
  damage already resolved, general information request, non-injury parking complaint, found property,
  welfare check with no indication of distress.
- UNCERTAIN: When you cannot confidently classify. Default to UNCERTAIN over NON_EMERGENCY when in doubt.

Safety rule: A false EMERGENCY classification is far less harmful than a false NON_EMERGENCY.
When uncertain, classify as UNCERTAIN — it will be treated as EMERGENCY operationally.

Respond ONLY with a valid JSON object matching this exact schema. No markdown, no preamble:
{
  "classification": "EMERGENCY" | "NON_EMERGENCY" | "UNCERTAIN",
  "confidence": <integer 0-100>,
  "reasoning": "<plain English, max 300 chars>",
  "sourceQuote": "<exact transcript phrase supporting classification, or null if UNCERTAIN>",
  "suggestedCategory": "<short descriptive string>",
  "suggestedPriority": "P1" | "P2" | "P3"
}`;

export function buildTriageUserPrompt(event: TriageAnalyzeEvent): string {
  const transcriptText = event.segments.map((s) => `[${s.speaker}]: ${s.text}`).join("\n");

  const durationMs =
    event.segments.length > 0
      ? event.segments[event.segments.length - 1]!.startMs - event.segments[0]!.startMs
      : 0;
  const durationSecs = Math.round(durationMs / 1000);

  return [
    `Agency: ${event.agencyName}`,
    `Transcript so far (${event.segments.length} segments, ~${durationSecs}s of audio):`,
    "",
    transcriptText,
    "",
    "Classify this call.",
  ].join("\n");
}
