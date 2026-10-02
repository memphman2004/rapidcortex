import type { ConfidenceInput, IConfidenceAiProvider } from "../confidenceProvider.js";
import { assertProviderAllowedForAgency } from "../../../ai/providerPolicy.js";
import { CONFIDENCE_SYSTEM_PROMPT, buildConfidenceUserPrompt } from "../prompt.js";

type AnthropicMessagesResponse = {
  id?: string;
  content?: { type: string; text?: string }[];
  error?: { type?: string; message?: string };
};

export type ConfidenceAnthropicAdapterConfig = {
  adapterName: string;
  model: string;
  apiKey: string;
  /** e.g. https://api.anthropic.com — path /v1/messages appended */
  baseUrl: string;
};

export class ConfidenceAnthropicAdapter implements IConfidenceAiProvider {
  readonly adapterName: string;
  readonly providerKind = "anthropic" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfidenceAnthropicAdapterConfig) {
    this.adapterName = config.adapterName;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  async score(input: ConfidenceInput, options?: { signal?: AbortSignal }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("Anthropic API key is not configured");
    }

    await assertProviderAllowedForAgency({
      agencyId: input.agencyId,
      provider: this.providerKind,
      surface: "ai",
    });

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
        max_tokens: 1500,
        temperature: 0,
        system: CONFIDENCE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildConfidenceUserPrompt(input.transcriptText),
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
