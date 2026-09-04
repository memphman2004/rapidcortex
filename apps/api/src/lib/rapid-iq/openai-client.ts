import OpenAI from "openai";
import {
  isRapidIqAiEnabled,
  isRapidIqWebSearchEnabled,
  resolveRapidIqOpenAiKey,
} from "./openai-config.js";

export type OpenAiJsonResult = {
  text: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let cachedClient: OpenAI | null = null;
let cachedKey = "";

async function getClient(): Promise<OpenAI | null> {
  if (!isRapidIqAiEnabled()) return null;
  const key = await resolveRapidIqOpenAiKey();
  if (!key) return null;
  if (cachedClient && cachedKey === key) return cachedClient;
  cachedClient = new OpenAI({ apiKey: key });
  cachedKey = key;
  return cachedClient;
}

export function resetRapidIqOpenAiClientForTests(): void {
  cachedClient = null;
  cachedKey = "";
}

function usageFrom(response: unknown): OpenAiJsonResult["usage"] {
  const usage =
    response && typeof response === "object" && "usage" in response
      ? (response as { usage?: Record<string, number> }).usage
      : undefined;
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens,
    outputTokens: usage.output_tokens ?? usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function outputTextFrom(response: {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
}): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export async function createJsonResponse(opts: {
  model: string;
  system: string;
  user: string;
  jsonSchemaName: string;
  jsonSchema: Record<string, unknown>;
  webSearch?: boolean;
  maxRetries?: number;
}): Promise<OpenAiJsonResult | null> {
  const client = await getClient();
  if (!client) return null;

  const useSearch = Boolean(opts.webSearch && isRapidIqWebSearchEnabled());
  const maxRetries = opts.maxRetries ?? 3;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const started = Date.now();
    try {
      const response = await client.responses.create({
        model: opts.model,
        instructions: opts.system,
        input: opts.user,
        temperature: 0.2,
        max_output_tokens: 2500,
        text: {
          format: {
            type: "json_schema",
            name: opts.jsonSchemaName,
            schema: opts.jsonSchema,
            strict: false,
          },
        },
        ...(useSearch ? { tools: [{ type: "web_search_preview" as const }] } : {}),
      });
      const text = outputTextFrom(response);
      if (!text) {
        throw new Error("empty_openai_output");
      }
      console.log(
        JSON.stringify({
          msg: "rapid_iq_openai_ok",
          model: opts.model,
          durationMs: Date.now() - started,
          usage: usageFrom(response),
          webSearch: useSearch,
        }),
      );
      return { text, model: opts.model, usage: usageFrom(response) };
    } catch (err) {
      lastError = err;
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as { status?: number }).status)
          : 0;
      const retryable = status === 429 || status >= 500 || status === 0;
      console.warn(
        JSON.stringify({
          msg: "rapid_iq_openai_error",
          model: opts.model,
          attempt,
          status,
          durationMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      if (!retryable || attempt === maxRetries - 1) break;
      await sleep(Math.min(8_000, 400 * 2 ** attempt));
    }
  }
  void lastError;
  return null;
}
