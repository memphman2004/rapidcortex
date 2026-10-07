import {
  BedrockRuntimeClient,
  ConverseCommand,
  ServiceUnavailableException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import type { AnalysisInput } from "../provider.js";
import type { IAIProvider } from "../iaiProvider.js";
import { assertProviderAllowedForAgency } from "../providerPolicy.js";
import { buildAnalysisUserMessage, DISPATCH_ANALYSIS_SYSTEM_PROMPT } from "../prompts.js";

export type BedrockAdapterConfig = {
  adapterName: string;
  modelId: string;
  region: string;
};

export class BedrockAdapter implements IAIProvider {
  readonly adapterName: string;
  readonly providerKind = "bedrock" as const;
  readonly model: string;
  private readonly client: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(config: BedrockAdapterConfig) {
    this.adapterName = config.adapterName;
    this.model = config.modelId;
    this.modelId = config.modelId;
    this.client = new BedrockRuntimeClient({ region: config.region });
  }

  async analyze(input: AnalysisInput, options?: { signal?: AbortSignal }): Promise<unknown> {
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
    const userText = prompt.message;
    try {
      const out = await this.client.send(
        new ConverseCommand({
          modelId: this.modelId,
          system: [{ text: DISPATCH_ANALYSIS_SYSTEM_PROMPT }],
          messages: [{ role: "user", content: [{ text: userText }] }],
          inferenceConfig: {
            maxTokens: 900,
            temperature: 0.15,
          },
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
