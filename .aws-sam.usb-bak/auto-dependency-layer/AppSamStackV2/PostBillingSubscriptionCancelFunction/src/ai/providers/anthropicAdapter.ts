import type { AnalysisInput } from "../provider.js";
import type { IAIProvider } from "../iaiProvider.js";
import { assertProviderAllowedForAgency } from "../providerPolicy.js";
import { buildAnalysisUserMessage, DISPATCH_ANALYSIS_SYSTEM_PROMPT } from "../prompts.js";

type AnthropicMessagesResponse = {
  id?: string;
  content?: { type: string; text?: string }[];
  error?: { type?: string; message?: string };
};

export type AnthropicAdapterConfig = {
  adapterName: string;
  model: string;
  apiKey: string;
  /** e.g. https://api.anthropic.com — path /v1/messages appended */
  baseUrl: string;
};

export class AnthropicAdapter implements IAIProvider {
  readonly adapterName: string;
  readonly providerKind = "anthropic" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: AnthropicAdapterConfig) {
    this.adapterName = config.adapterName;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  async analyze(input: AnalysisInput, options?: { signal?: AbortSignal }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("Anthropic API key is not configured");
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

    const url = `${this.baseUrl}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      signal: options?.signal,
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        temperature: 0.15,
        system: DISPATCH_ANALYSIS_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: prompt.message,
          },
        ],
      }),
    });

    const body = (await res.json()) as AnthropicMessagesResponse;
    if (!res.ok) {
      const msg = body.error?.message ?? res.statusText;
      throw new Error(`Anthropic request failed (${res.status}): ${msg}`);
    }

    const block = body.content?.find((c) => c.type === "text");
    const text = block?.text?.trim() ?? "";
    if (!text) {
      throw new Error("Anthropic returned empty text content");
    }
    return text;
  }
}
