import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import type { TriageAiClassification, TriageAnalyzeEvent, TriagePriority } from "rapid-cortex-shared";
import { TRIAGE_SYSTEM_PROMPT, buildTriageUserPrompt } from "./prompt.js";
import { env } from "../env.js";
import { isQuoteGroundedInTranscript } from "../validation/grounding-verifier.js";

function modelId(): string {
  return process.env.BEDROCK_MODEL_PRIMARY?.trim() || "anthropic.claude-3-5-haiku-20241022-v1:0";
}

export function mockClassify(event: TriageAnalyzeEvent): TriageAiClassification {
  const id = event.incidentId.toLowerCase();
  const isNonEmergency = id.includes("nonemerge") || id.includes("nonemerg");

  return {
    classification: isNonEmergency ? "NON_EMERGENCY" : "EMERGENCY",
    confidence: isNonEmergency ? 88 : 95,
    reasoning: isNonEmergency
      ? "[MOCK] Transcript indicates noise complaint with no threat."
      : "[MOCK] Default EMERGENCY classification in mock mode.",
    suggestedCategory: isNonEmergency ? "Noise Complaint" : "Unknown",
    suggestedPriority: isNonEmergency ? "P3" : "P1",
    processedAt: new Date().toISOString(),
    segmentCount: event.segments.length,
    mock: true,
  };
}

function parseClassifierJson(text: string): {
  classification: string;
  confidence: number;
  reasoning: string;
  sourceQuote?: string | null;
  suggestedCategory: string;
  suggestedPriority: string;
} {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  return JSON.parse(slice) as {
    classification: string;
    confidence: number;
    reasoning: string;
    sourceQuote?: string | null;
    suggestedCategory: string;
    suggestedPriority: string;
  };
}

function uncertainFallback(segmentCount: number, reasoning: string): TriageAiClassification {
  return {
    classification: "UNCERTAIN",
    confidence: 0,
    reasoning,
    suggestedCategory: "Unknown",
    suggestedPriority: "P1",
    processedAt: new Date().toISOString(),
    segmentCount,
  };
}

export async function classifyWithBedrock(event: TriageAnalyzeEvent): Promise<TriageAiClassification> {
  const client = new BedrockRuntimeClient({ region: env.region });
  const userPrompt = buildTriageUserPrompt(event);

  try {
    const out = await client.send(
      new ConverseCommand({
        modelId: modelId(),
        system: [{ text: TRIAGE_SYSTEM_PROMPT }],
        messages: [{ role: "user", content: [{ text: userPrompt }] }],
        inferenceConfig: { maxTokens: 512, temperature: 0 },
      }),
    );

    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    if (!text) {
      return uncertainFallback(event.segments.length, "Classifier returned empty response.");
    }

    let parsed: ReturnType<typeof parseClassifierJson>;
    try {
      parsed = parseClassifierJson(text);
    } catch {
      console.error(JSON.stringify({ type: "triage.classifier_parse_error", raw: text.slice(0, 200) }));
      return uncertainFallback(
        event.segments.length,
        "Classifier response could not be parsed. Defaulting to UNCERTAIN.",
      );
    }

    const validClasses = ["EMERGENCY", "NON_EMERGENCY", "UNCERTAIN"] as const;
    const classification = validClasses.includes(parsed.classification as (typeof validClasses)[number])
      ? (parsed.classification as (typeof validClasses)[number])
      : "UNCERTAIN";

    const confidence = Math.min(100, Math.max(0, Math.round(parsed.confidence ?? 0)));
    const transcriptText = event.segments.map((s) => `[${s.speaker}]: ${s.text}`).join("\n");
    const sourceQuote = parsed.sourceQuote?.trim() || null;
    const quoteGrounded = isQuoteGroundedInTranscript(sourceQuote, transcriptText);

    let finalClassification =
      classification === "NON_EMERGENCY" && confidence < 70 ? "UNCERTAIN" : classification;

    if (
      (finalClassification === "NON_EMERGENCY" || finalClassification === "EMERGENCY") &&
      !quoteGrounded
    ) {
      finalClassification = "UNCERTAIN";
    }

    const priorityRaw = parsed.suggestedPriority;
    const suggestedPriority: TriagePriority =
      priorityRaw === "P1" || priorityRaw === "P2" || priorityRaw === "P3" ? priorityRaw : "P1";

    return {
      classification: finalClassification,
      confidence: finalClassification === "UNCERTAIN" && !quoteGrounded ? 0 : confidence,
      reasoning: !quoteGrounded
        ? `${(parsed.reasoning ?? "").slice(0, 220)} [No verifiable transcript citation.]`.slice(0, 300)
        : (parsed.reasoning ?? "").slice(0, 300),
      sourceQuote: quoteGrounded ? sourceQuote : null,
      suggestedCategory: parsed.suggestedCategory ?? "Unknown",
      suggestedPriority,
      processedAt: new Date().toISOString(),
      segmentCount: event.segments.length,
    };
  } catch (err) {
    if (err instanceof ThrottlingException || err instanceof ServiceUnavailableException) {
      console.error(JSON.stringify({ type: "triage.classifier_bedrock_error", message: err.message }));
    }
    throw err;
  }
}

export async function classifyTranscript(event: TriageAnalyzeEvent): Promise<TriageAiClassification> {
  if (env.triageMock) return mockClassify(event);
  return classifyWithBedrock(event);
}
