import type { AnalysisInput } from "./provider.js";

export type AiProviderKind = "openai" | "anthropic" | "bedrock" | "mock";

export interface IAIProvider {
  readonly adapterName: string;
  readonly providerKind: AiProviderKind;
  readonly model: string;
  analyze(input: AnalysisInput, options?: { signal?: AbortSignal }): Promise<unknown>;
}
