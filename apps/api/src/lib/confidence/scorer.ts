import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import type { ConfidenceAnalysis } from "rapid-cortex-shared";
import { env } from "../env.js";
import {
  buildFieldsFromParsed,
  computeAggregate,
  mockScoreConfidence,
} from "./aggregate.js";
import { CONFIDENCE_SYSTEM_PROMPT, buildConfidenceUserPrompt } from "./prompt.js";
import type { GroundingFlag } from "../validation/grounding-verifier.js";

export type ConfidenceScoreResult = {
  analysis: ConfidenceAnalysis;
  groundingFlags: GroundingFlag[];
};

function modelId(): string {
  return process.env.BEDROCK_MODEL_PRIMARY?.trim() || "anthropic.claude-3-5-haiku-20241022-v1:0";
}

function parseJson(text: string): unknown {
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  return JSON.parse(slice);
}

export async function scoreConfidenceWithBedrock(
  incidentId: string,
  agencyId: string,
  transcriptText: string,
  segmentCount: number,
  version: number,
  previous?: ConfidenceAnalysis,
): Promise<ConfidenceScoreResult> {
  const client = new BedrockRuntimeClient({ region: env.region });

  try {
    const out = await client.send(
      new ConverseCommand({
        modelId: modelId(),
        system: [{ text: CONFIDENCE_SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: [{ text: buildConfidenceUserPrompt(transcriptText) }],
          },
        ],
        inferenceConfig: { maxTokens: 1500, temperature: 0 },
      }),
    );

    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    if (!text) {
      throw new Error("Empty Bedrock response");
    }

    const parsed = parseJson(text) as {
      fields: Record<
        string,
        {
          value: string | null;
          sourceQuote?: string | null;
          score: number;
          reason: string;
          suggestedQuestion: string | null;
          conflictingValues: string[];
        }
      >;
      audioQualityFactor: number;
    };

    const audioQualityFactor = Math.min(1, Math.max(0.1, parsed.audioQualityFactor ?? 1));
    const { fields, groundingFlags } = buildFieldsFromParsed(
      parsed.fields ?? {},
      segmentCount,
      previous,
      transcriptText,
    );
    const aggregate = computeAggregate(fields, audioQualityFactor, segmentCount);

    return {
      analysis: {
        incidentId,
        agencyId,
        fields,
        aggregate,
        version,
        previousVersion: previous?.version,
      },
      groundingFlags,
    };
  } catch (err) {
    if (err instanceof ThrottlingException || err instanceof ServiceUnavailableException) {
      console.error(JSON.stringify({ type: "confidence.bedrock_error", message: err.message }));
    }
    throw err;
  }
}

export async function scoreConfidence(
  incidentId: string,
  agencyId: string,
  transcriptText: string,
  segmentCount: number,
  version: number,
  previous?: ConfidenceAnalysis,
): Promise<ConfidenceScoreResult> {
  if (env.confidenceScoringMock) {
    const analysis = mockScoreConfidence(incidentId, agencyId, segmentCount, version, previous);
    return { analysis, groundingFlags: [] };
  }

  try {
    return await scoreConfidenceWithBedrock(
      incidentId,
      agencyId,
      transcriptText,
      segmentCount,
      version,
      previous,
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        type: "confidence.scorer_failed",
        incidentId,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    if (previous) {
      return {
        analysis: { ...previous, version, previousVersion: previous.version },
        groundingFlags: [],
      };
    }
    return {
      analysis: mockScoreConfidence(incidentId, agencyId, segmentCount, version),
      groundingFlags: [],
    };
  }
}
