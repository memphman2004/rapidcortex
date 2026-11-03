import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  salesEmailPolishMockFixture,
  salesEmailPolishResultSchema,
  type SalesEmailPolishRequest,
  type SalesEmailPolishResult,
} from "rapid-cortex-shared";

const SYSTEM_PROMPT = `You polish outbound sales emails for NexCort iQ (public safety, campus, venue, transit software).
Fix grammar, spelling, clarity, and professional tone. Keep placeholders like {{name}}, {{agency}}, {{rep}} unchanged.
Do not invent product claims, pricing, or CJIS-controlled facts. Do not add marketing hype.
Return ONLY valid JSON:
{
  "subject": string,
  "body": string,
  "notes": string[]  // brief list of what you changed (max 6)
}`;

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

export async function polishSalesEmail(
  input: SalesEmailPolishRequest,
): Promise<SalesEmailPolishResult> {
  if (bedrockMockEnabled()) {
    return salesEmailPolishMockFixture(input);
  }

  const modelId =
    process.env.SALES_EMAIL_POLISH_BEDROCK_MODEL_ID?.trim() ||
    process.env.SALES_CALL_COACH_BEDROCK_MODEL_ID?.trim() ||
    process.env.QA_BEDROCK_MODEL_ID?.trim() ||
    process.env.AI_BEDROCK_MODEL_PRIMARY?.trim() ||
    "";
  if (!modelId) {
    return salesEmailPolishMockFixture(input);
  }

  const region =
    process.env.AWS_REGION?.trim() || process.env.AWS_DEFAULT_REGION?.trim() || "us-east-1";
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
                text: `Tone: ${input.tone}\n\nSubject:\n${input.subject || "(none)"}\n\nBody:\n${input.body}`,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: 2200,
          temperature: 0.2,
        },
      }),
    );

    const blocks = out.output?.message?.content;
    const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
    if (!text) {
      return salesEmailPolishMockFixture(input);
    }
    const parsed = salesEmailPolishResultSchema.safeParse({
      ...(extractJsonObject(text) as Record<string, unknown>),
      mock: false,
    });
    if (!parsed.success) {
      console.warn(
        JSON.stringify({
          msg: "sales_email_polish_parse_failed",
          issues: parsed.error.issues.slice(0, 5),
        }),
      );
      return salesEmailPolishMockFixture(input);
    }
    return parsed.data;
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "sales_email_polish_bedrock_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return salesEmailPolishMockFixture(input);
  }
}
