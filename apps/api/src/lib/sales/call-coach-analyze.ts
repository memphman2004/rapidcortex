import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  salesCallCoachMockFixture,
  salesCallCoachResultSchema,
  type SalesCallCoachAnalyzeRequest,
  type SalesCallCoachResult,
} from "rapid-cortex-shared";

const SYSTEM_PROMPT = `You are a sales call coach for NexCort iQ (public safety / campus / venue / transit software).
Score the pasted sales call transcript. Return ONLY valid JSON matching this shape:
{
  "overallScore": number 0-10,
  "verdict": string,
  "categories": [
    {
      "id": string,
      "label": string,
      "score": number 0-10,
      "strengths": string[],
      "improvements": string[]
    }
  ],
  "redFlags": string[],
  "nextSteps": string[]
}
Use exactly these six category ids: rapport, discovery, value, objection, listening, close.
Be specific to public-safety sales. Never invent CJIS-controlled facts.`;

function bedrockMockEnabled(): boolean {
  const v = process.env.BEDROCK_MOCK?.trim();
  return v === "1" || v?.toLowerCase() === "true";
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as unknown;
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim()) as unknown;
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  }
  throw new Error("Model response did not contain JSON");
}

export async function analyzeSalesCallTranscript(
  input: SalesCallCoachAnalyzeRequest,
): Promise<SalesCallCoachResult> {
  if (bedrockMockEnabled()) {
    return salesCallCoachMockFixture({ mock: true });
  }

  const modelId =
    process.env.SALES_CALL_COACH_BEDROCK_MODEL_ID?.trim() ||
    process.env.QA_BEDROCK_MODEL_ID?.trim() ||
    process.env.AI_BEDROCK_MODEL_PRIMARY?.trim() ||
    "";
  if (!modelId) {
    return salesCallCoachMockFixture({ mock: true });
  }

  const region = process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || "us-east-1";
  const client = new BedrockRuntimeClient({ region });

  try {
    const out = await client.send(
      new ConverseCommand({
        modelId,
        system: [{ text: SYSTEM_PROMPT }],
        messages: [
          {
            role: "user",
            content: [
              {
                text: `Vertical: ${input.vertical}\n\nTranscript:\n${input.transcript}`,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: 1800,
          temperature: 0.2,
        },
      }),
    );

    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    if (!text) {
      return salesCallCoachMockFixture({ mock: true });
    }
    const parsed = salesCallCoachResultSchema.safeParse({
      ...(extractJsonObject(text) as Record<string, unknown>),
      mock: false,
    });
    if (!parsed.success) {
      console.warn(
        JSON.stringify({
          msg: "sales_call_coach_parse_failed",
          issues: parsed.error.issues.slice(0, 5),
        }),
      );
      return salesCallCoachMockFixture({ mock: true });
    }
    return parsed.data;
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "sales_call_coach_bedrock_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return salesCallCoachMockFixture({ mock: true });
  }
}
