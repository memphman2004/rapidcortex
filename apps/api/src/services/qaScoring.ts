import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import type { QAProtocolTemplate, QAStructuredScore } from "rapid-cortex-shared";
import { qaStructuredScoreSchema } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const SYSTEM_PROMPT = `You are an emergency communications QA analyst. Score the dispatcher against the checklist using ONLY the transcript text.
Return STRICT JSON with this shape:
{"checklist":[{"id":"...","score":0-5,"passed":boolean,"rationale":"short","evidenceQuote":"verbatim snippet from transcript"}],"aggregateScore":0-100}
Rules:
- checklist must include every checklist id from the provided template, in the same order as given.
- evidenceQuote must be a SHORT substring copied exactly from the transcript (one line or partial line), or empty string if nothing supports the score.
- aggregateScore is a weighted summary (0-100).
- No markdown, no prose outside JSON.`;

function buildUserMessage(transcriptText: string, template: QAProtocolTemplate): string {
  const lines = template.checklistItems.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  return `Checklist:\n${lines}\n\nTranscript:\n${transcriptText}`;
}

export async function scoreQaWithBedrock(
  transcriptText: string,
  template: QAProtocolTemplate,
): Promise<QAStructuredScore> {
  const modelId = env.qaBedrockModelId;
  if (!modelId) {
    throw new Error("QA_BEDROCK_MODEL_ID_NOT_SET");
  }
  const client = new BedrockRuntimeClient({ region: env.region });
  const out = await client.send(
    new ConverseCommand({
      modelId,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [{ text: buildUserMessage(transcriptText, template) }],
        },
      ],
      inferenceConfig: { maxTokens: 1200, temperature: 0.1 },
    }),
  );
  const blocks = out.output?.message?.content;
  const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
  if (!text) throw new Error("Bedrock returned empty assistant text for QA scoring");
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  const slice = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice) as unknown;
  } catch {
    throw new Error("QA_SCORING_JSON_PARSE_FAILED");
  }
  const safe = qaStructuredScoreSchema.safeParse(parsed);
  if (!safe.success) {
    throw new Error(`QA_SCORING_SCHEMA_FAILED: ${safe.error.message}`);
  }
  const expectedIds = new Set(template.checklistItems.map((c) => c.id));
  for (const row of safe.data.checklist) {
    if (!expectedIds.has(row.id)) {
      throw new Error(`QA_SCORING_UNKNOWN_CHECKLIST_ID:${row.id}`);
    }
  }
  if (safe.data.checklist.length !== template.checklistItems.length) {
    throw new Error("QA_SCORING_CHECKLIST_LENGTH_MISMATCH");
  }
  return safe.data;
}

export function scoreQaMock(transcriptText: string, template: QAProtocolTemplate): QAStructuredScore {
  const len = Math.min(5000, transcriptText.length);
  const base = len > 200 ? 4 : 2;
  return {
    checklist: template.checklistItems.map((c, i) => ({
      id: c.id,
      score: Math.min(5, base + (i % 2)),
      passed: base + (i % 2) >= 3,
      rationale: "Mock scorer (QA_SCORING_MOCK=1)",
      evidenceQuote: transcriptText.slice(0, Math.min(120, transcriptText.length)),
    })),
    aggregateScore: Math.min(100, 55 + (len % 40)),
  };
}

export async function runStructuredQaScore(
  transcriptText: string,
  template: QAProtocolTemplate,
): Promise<{ score: QAStructuredScore; modelId: string; raw: string }> {
  if (env.qaScoringMock) {
    const score = scoreQaMock(transcriptText, template);
    return { score, modelId: "mock", raw: JSON.stringify(score) };
  }
  try {
    const score = await scoreQaWithBedrock(transcriptText, template);
    return {
      score,
      modelId: env.qaBedrockModelId,
      raw: JSON.stringify(score),
    };
  } catch (err) {
    if (err instanceof ThrottlingException) {
      throw new Error(`Bedrock QA throttled: ${err.message}`);
    }
    if (err instanceof ServiceUnavailableException) {
      throw new Error(`Bedrock QA unavailable: ${err.message}`);
    }
    throw err;
  }
}
