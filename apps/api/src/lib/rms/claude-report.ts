import type { GenerateReportRequest, IncidentReport, NibrsClassification } from "rapid-cortex-shared";
import { resolvePlainOrSecretArn } from "../runtimeSecrets.js";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function resolveAnthropicApiKey(): Promise<string | null> {
  const key = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_API_KEY_SECRET_ARN,
    { preferredField: "apiKey" },
  );
  return key?.trim() || null;
}

export function isRmsMockMode(): boolean {
  return (
    process.env.RMS_MOCK === "1" ||
    process.env.RMS_MOCK === "true" ||
    process.env.ENABLE_RMS_MOCK === "1" ||
    process.env.ENABLE_RMS_MOCK === "true"
  );
}

export function buildReportPrompt(req: GenerateReportRequest): string {
  const style = req.agencyPreferences?.narrativeStyle ?? "first_person";
  const includeCallerStatements = req.agencyPreferences?.includeCallerStatements !== false;
  const state = req.agencyPreferences?.jurisdictionState ?? "";

  return `You are an expert law enforcement report writer. Generate a complete, professional incident report from the following 911 call data.

CALL TRANSCRIPT:
${req.transcript}

EXTRACTED INCIDENT DATA:
- Incident Type: ${req.extractedEntities.incidentType ?? "Not specified"}
- Location: ${req.extractedEntities.location ?? "Not specified"}
- Suspects: ${JSON.stringify(req.extractedEntities.suspects ?? [])}
- Victims: ${JSON.stringify(req.extractedEntities.victims ?? [])}
- Vehicles: ${JSON.stringify(req.extractedEntities.vehicles ?? [])}
- Weapons: ${(req.extractedEntities.weapons ?? []).join(", ") || "None reported"}
- Injuries: ${req.extractedEntities.injuries ?? req.extractedEntities.additionalContext ?? "None reported"}

CALL METADATA:
- Date: ${req.callMetadata?.callDate ?? "Unknown"}
- Time: ${req.callMetadata?.callTime ?? "Unknown"}
- Duration: ${req.callMetadata?.callDurationSeconds ? `${req.callMetadata.callDurationSeconds}s` : "Unknown"}
- CAD Number: ${req.callMetadata?.cadNumber ?? "Pending"}
${state ? `- Jurisdiction: ${state}` : ""}

REPORT REQUIREMENTS:
- Narrative style: ${style === "first_person" ? "First person (I responded to...)" : "Third person (Officers responded to...)"}
- ${includeCallerStatements ? "Include direct caller statements where relevant (attributed as 'the caller stated...')" : "Do not include direct caller statements"}
- Write in law enforcement report style — factual, objective, specific
- Include only what was reported/observed — no speculation
- Use specific times, descriptions, and details from the transcript
- Ensure suspect/victim descriptions are complete and accurate

Respond ONLY with valid JSON (no markdown):
{
  "officerNarrative": "Full multi-paragraph incident narrative...",
  "suspectDescription": "Physical description(s) of suspect(s) or null",
  "victimInformation": "Victim details and statements or null",
  "vehicleInformation": "Vehicle description(s) or null",
  "evidenceSummary": "Any evidence mentioned or null",
  "officerObservations": "Any conditions, observations, or context or null",
  "dispositionSummary": "How the call concluded or null",
  "suspects": [],
  "victims": [],
  "witnesses": [],
  "vehicles": [],
  "nibrsOffenseCode": "e.g. 13A",
  "nibrsOffenseDescription": "e.g. Aggravated Assault",
  "nibrsOffenseGroup": "A or B",
  "nibrsLocationType": "e.g. 20",
  "nibrsLocationDescription": "e.g. Residence",
  "nibrsAttemptedCompleted": "A or C",
  "nibrsConfidence": 85,
  "nibrsRationale": "Brief explanation of why this code applies",
  "nibrsAlternatives": [
    { "offenseCode": "13B", "offenseDescription": "Simple Assault", "confidence": 40 }
  ]
}`;
}

export function buildNibrsPrompt(incidentType: string, description: string, state: string): string {
  return `You are a NIBRS compliance specialist. Classify this incident using the FBI NIBRS offense codes.

Incident Type: ${incidentType}
Description: ${description}
${state ? `Jurisdiction: ${state}` : ""}

Respond ONLY with valid JSON:
{
  "offenseCode": "e.g. 13A",
  "offenseGroup": "A or B",
  "offenseDescription": "e.g. Aggravated Assault",
  "locationTypeCode": "e.g. 20",
  "locationTypeDescription": "e.g. Residence",
  "attemptedCompleted": "A or C",
  "confidence": 85,
  "aiRationale": "Brief explanation",
  "alternativeCodes": [
    { "offenseCode": "13B", "offenseDescription": "Simple Assault", "confidence": 40 }
  ]
}`;
}

export async function streamClaudeText(prompt: string, maxTokens = 4096): Promise<string> {
  if (isRmsMockMode()) {
    return JSON.stringify(mockReportPayload());
  }

  const apiKey = await resolveAnthropicApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.body) throw new Error("Claude returned an empty stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text: string };
        };
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          fullText += parsed.delta.text;
        }
      } catch {
        /* skip */
      }
    }
  }
  return fullText;
}

export async function completeClaudeJson(prompt: string, maxTokens = 500): Promise<string> {
  if (isRmsMockMode()) {
    return JSON.stringify(mockNibrsPayload());
  }

  const apiKey = await resolveAnthropicApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  return data.content.find((b) => b.type === "text")?.text ?? "{}";
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

export function nibrsFromParsed(parsed: Record<string, unknown>): NibrsClassification | undefined {
  if (!parsed.nibrsOffenseCode && !parsed.offenseCode) return undefined;
  return {
    offenseCode: String(parsed.nibrsOffenseCode ?? parsed.offenseCode ?? ""),
    offenseGroup: (String(parsed.nibrsOffenseGroup ?? parsed.offenseGroup ?? "A") === "B"
      ? "B"
      : "A") as "A" | "B",
    offenseDescription: String(
      parsed.nibrsOffenseDescription ?? parsed.offenseDescription ?? "",
    ),
    locationTypeCode: String(parsed.nibrsLocationType ?? parsed.locationTypeCode ?? ""),
    locationTypeDescription: String(
      parsed.nibrsLocationDescription ?? parsed.locationTypeDescription ?? "",
    ),
    attemptedCompleted: (String(parsed.nibrsAttemptedCompleted ?? parsed.attemptedCompleted ?? "C") ===
    "A"
      ? "A"
      : "C") as "A" | "C",
    confidence: Number(parsed.nibrsConfidence ?? parsed.confidence ?? 70),
    aiRationale: String(parsed.nibrsRationale ?? parsed.aiRationale ?? ""),
    alternativeCodes:
      (parsed.nibrsAlternatives as NibrsClassification["alternativeCodes"]) ??
      (parsed.alternativeCodes as NibrsClassification["alternativeCodes"]) ??
      [],
  };
}

function mockReportPayload(): Record<string, unknown> {
  return {
    officerNarrative:
      "[MOCK] I responded to a reported disturbance. The caller stated a verbal argument occurred at the listed address. No injuries were reported at the time of the call.",
    suspectDescription: "[MOCK] Adult male, dark clothing, last seen walking northbound.",
    victimInformation: "[MOCK] Caller reported being the victim of a verbal disturbance.",
    vehicleInformation: null,
    evidenceSummary: null,
    officerObservations: "[MOCK] Scene was calm on arrival in mock mode.",
    dispositionSummary: "[MOCK] Information obtained; report generated in RMS mock mode.",
    suspects: [
      {
        role: "suspect",
        clothing: "dark clothing",
        extractedFromCall: true,
      },
    ],
    victims: [{ role: "victim", extractedFromCall: true }],
    witnesses: [],
    vehicles: [],
    nibrsOffenseCode: "90C",
    nibrsOffenseDescription: "Disorderly Conduct",
    nibrsOffenseGroup: "B",
    nibrsLocationType: "20",
    nibrsLocationDescription: "Residence",
    nibrsAttemptedCompleted: "C",
    nibrsConfidence: 72,
    nibrsRationale: "Mock classification for local/CI testing.",
    nibrsAlternatives: [
      { offenseCode: "13B", offenseDescription: "Simple Assault", confidence: 35 },
    ],
  };
}

function mockNibrsPayload(): NibrsClassification {
  return {
    offenseCode: "90C",
    offenseGroup: "B",
    offenseDescription: "Disorderly Conduct",
    locationTypeCode: "20",
    locationTypeDescription: "Residence",
    attemptedCompleted: "C",
    confidence: 70,
    aiRationale: "Mock NIBRS classification.",
    alternativeCodes: [
      { offenseCode: "13B", offenseDescription: "Simple Assault", confidence: 30 },
    ],
  };
}

export type ClaudeReportParsed = {
  narrative: IncidentReport["narrative"];
  suspects: IncidentReport["suspects"];
  victims: IncidentReport["victims"];
  witnesses: IncidentReport["witnesses"];
  vehicles: IncidentReport["vehicles"];
  nibrsClassification?: NibrsClassification;
};
