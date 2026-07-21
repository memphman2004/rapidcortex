import type { ConfidenceInput, IConfidenceAiProvider } from "../confidenceProvider.js";
import { assertProviderAllowedForAgency } from "../../../ai/providerPolicy.js";
import { CONFIDENCE_SYSTEM_PROMPT, buildConfidenceUserPrompt } from "../prompt.js";

type ChatCompletionResponse = {
  id?: string;
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

export type ConfidenceOpenAiAdapterConfig = {
  adapterName: string;
  model: string;
  apiKey: string;
  baseUrl: string;
};

export class ConfidenceOpenAiAdapter implements IConfidenceAiProvider {
  readonly adapterName: string;
  readonly providerKind = "openai" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfidenceOpenAiAdapterConfig) {
    this.adapterName = config.adapterName;
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  async score(input: ConfidenceInput, options?: { signal?: AbortSignal }): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is not configured");
    }

    await assertProviderAllowedForAgency({
      agencyId: input.agencyId,
      provider: this.providerKind,
      surface: "ai",
    });

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
        temperature: 0,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CONFIDENCE_SYSTEM_PROMPT },
          { role: "user", content: buildConfidenceUserPrompt(input.transcriptText) },
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
