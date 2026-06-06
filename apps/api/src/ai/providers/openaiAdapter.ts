import type { AnalysisInput } from "../provider.js";
import type { IAIProvider } from "../iaiProvider.js";
import { assertProviderAllowedForAgency } from "../providerPolicy.js";
import { buildAnalysisUserMessage, DISPATCH_ANALYSIS_SYSTEM_PROMPT } from "../prompts.js";

type ChatCompletionResponse = {
  id?: string;
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export type OpenAiAdapterConfig = {
  adapterName: string;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export class OpenAiAdapter implements IAIProvider {
  readonly adapterName: string;
  readonly providerKind = "openai" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: OpenAiAdapterConfig) {
    this.adapterName = config.adapterName;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  async analyze(input: AnalysisInput, options?: { signal?: AbortSignal }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }

    await assertProviderAllowedForAgency({
      agencyId: input.agencyId,
      provider: this.providerKind,
      surface: "ai",
    });
    const prompt = buildAnalysisUserMessage(input, this.providerKind);
    console.log(
      JSON.stringify({
        type: "ai.prompt.sanitized",
        provider: this.providerKind,
        incidentId: input.incidentId,
        agencyId: input.agencyId,
        sanitization: prompt.sanitization,
        at: new Date().toISOString(),
      }),
    );

    const url = `${this.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      signal: options?.signal,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.15,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DISPATCH_ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content: prompt.message },
        ],
      }),
    });

    const body = (await res.json()) as ChatCompletionResponse;
    if (!res.ok) {
      const msg = body.error?.message ?? res.statusText;
      throw new Error(`OpenAI request failed (${res.status}): ${msg}`);
    }

    const content = body.choices?.[0]?.message?.content;
    if (content == null || content.trim() === "") {
      throw new Error("OpenAI returned empty message content");
    }

    return content;
  }
}

