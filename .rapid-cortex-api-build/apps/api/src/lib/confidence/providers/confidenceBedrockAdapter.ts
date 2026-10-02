import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import type { ConfidenceInput, IConfidenceAiProvider } from "../confidenceProvider.js";
import { assertProviderAllowedForAgency } from "../../../ai/providerPolicy.js";
import { CONFIDENCE_SYSTEM_PROMPT, buildConfidenceUserPrompt } from "../prompt.js";

export type ConfidenceBedrockAdapterConfig = {
  adapterName: string;
  modelId: string;
  region: string;
};

export class ConfidenceBedrockAdapter implements IConfidenceAiProvider {
  readonly adapterName: string;
  readonly providerKind = "bedrock" as const;
  readonly model: string;
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(config: ConfidenceBedrockAdapterConfig) {
    this.adapterName = config.adapterName;
    this.model = config.modelId;
    this.modelId = config.modelId;
    this.client = new BedrockRuntimeClient({ region: config.region });
  }

  async score(input: ConfidenceInput, options?: { signal?: AbortSignal }): Promise<unknown> {
    await assertProviderAllowedForAgency({
      agencyId: input.agencyId,
      provider: this.providerKind,
      surface: "ai",
    });

    try {
      const out = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: CONFIDENCE_SYSTEM_PROMPT }],
          messages: [{ role: "user", content: [{ text: buildConfidenceUserPrompt(input.transcriptText) }] }],
          inferenceConfig: { maxTokens: 1500, temperature: 0 },
        }),
        { abortSignal: options?.signal },
      );

      const blocks = out.output?.message?.content;
      const text = blocks?.map((b) => ("text" in b ? b.text : "")).join("")?.trim() ?? "";
      if (!text) {
        throw new Error("Bedrock returned empty assistant text");
      }
      return text;
    } catch (err) {
      if (err instanceof ThrottlingException) {
        throw new Error(`Bedrock request failed (429): ${err.message}`);
      }
      if (err instanceof ServiceUnavailableException) {
        throw new Error(`Bedrock request failed (503): ${err.message}`);
      }
      const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "";
      if (name === "ValidationException") {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Bedrock request failed (400): ${msg}`);
      }
      throw err;
    }
  }
}
