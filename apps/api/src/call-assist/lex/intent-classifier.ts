import type { AgencyTaxonomy, CallType } from "rapid-cortex-shared";
import { classifyCallTriage } from "rapid-cortex-shared";

export type ClassificationResult = {
  intentName: string;
  confidence: number;
  reasoning: string;
  slots: Record<string, string | null>;
};

const CALL_TYPE_TO_LEX_INTENT: Record<string, string> = {
  PARKING: "ParkingComplaint",
  medical: "MedicalAssistance",
  security: "SecurityIncident",
  lost_person: "LostPerson",
  CARFAX_REPORTING_ELIGIBLE: "CarfaxReportingEligible",
  CODE_ENFORCEMENT: "CodeEnforcement",
  PUBLIC_WORKS: "PublicWorks",
};

/** Maps call type id (NOISE_COMPLAINT or noise_complaint) to Lex PascalCase intent. */
export function intentName(callTypeId: string): string {
  if (CALL_TYPE_TO_LEX_INTENT[callTypeId]) return CALL_TYPE_TO_LEX_INTENT[callTypeId];
  return callTypeId
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/** Lex intent names that do not match intentName(callTypeId). */
const LEX_INTENT_ALIASES: Record<string, string> = {
  ParkingComplaint: "PARKING",
  MedicalAssistance: "medical",
  SecurityIncident: "security",
  LostPerson: "lost_person",
  CarfaxReportingEligible: "CARFAX_REPORTING_ELIGIBLE",
  CodeEnforcement: "CODE_ENFORCEMENT",
  PublicWorks: "PUBLIC_WORKS",
};

export function findCallTypeForIntent(taxonomy: AgencyTaxonomy, intent: string): CallType | undefined {
  const aliased = LEX_INTENT_ALIASES[intent];
  return taxonomy.callTypes.find(
    (t) =>
      intentName(t.id) === intent ||
      t.id === intent ||
      (aliased !== undefined && (t.id === aliased || intentName(t.id) === aliased)),
  );
}

/**
 * Taxonomy keyword classifier first. Bedrock Haiku only when still uncertain.
 * Tests and CI set CALL_ASSIST_LEX_BEDROCK_MOCK=1 (no live model).
 */
export async function classifyWithBedrock(
  utterance: string,
  _history: string[],
  taxonomy: AgencyTaxonomy,
): Promise<ClassificationResult> {
  const triage = classifyCallTriage(utterance, { taxonomy });
  const id = triage.matchedCallTypeId ?? triage.primaryClassification;
  const name = intentName(id);
  if (triage.emergencyDetected) {
    return { intentName: "EmergencyEscalation", confidence: 1, reasoning: "safety_in_classifier", slots: {} };
  }
  if (id && id !== "UNKNOWN" && id !== "unknown" && triage.confidence >= 0.7) {
    return { intentName: name, confidence: triage.confidence, reasoning: "taxonomy", slots: {} };
  }

  if (process.env.CALL_ASSIST_LEX_BEDROCK_MOCK === "1" || process.env.BEDROCK_MOCK === "1") {
    return {
      intentName: id && id !== "UNKNOWN" && id !== "unknown" ? name : "FallbackIntent",
      confidence: triage.confidence,
      reasoning: "mock_no_bedrock",
      slots: {},
    };
  }

  try {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const modelId = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-haiku-20240307-v1:0";
    const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const typeList = taxonomy.callTypes
      .filter((t) => t.enabled && !t.isEmergency)
      .map((t) => `- ${intentName(t.id)}: ${t.label}`)
      .join("\n");
    const prompt = `Classify this non-emergency caller utterance into exactly one intent name from the list.
INTENTS:
${typeList}
- FallbackIntent
UTTERANCE: "${utterance}"
Respond ONLY with JSON: {"intentName":"...","confidence":0.0,"reasoning":"...","slots":{}}`;
    const response = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 256,
          messages: [{ role: "user", content: prompt }],
        }),
      }),
    );
    const body = JSON.parse(new TextDecoder().decode(response.body)) as { content?: Array<{ text?: string }> };
    const text = body.content?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text) as ClassificationResult;
    if (!parsed.intentName) throw new Error("missing intentName");
    return {
      intentName: parsed.intentName,
      confidence: Number(parsed.confidence) || 0,
      reasoning: parsed.reasoning ?? "bedrock",
      slots: parsed.slots ?? {},
    };
  } catch {
    return { intentName: "FallbackIntent", confidence: 0, reasoning: "bedrock_error", slots: {} };
  }
}
