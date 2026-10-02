import type { AiProviderKind } from "../../ai/iaiProvider.js";

export interface ConfidenceInput {
  incidentId: string;
  agencyId: string;
  transcriptText: string;
}

export interface IConfidenceAiProvider {
  readonly adapterName: string;
  readonly providerKind: AiProviderKind;
  readonly model: string;
  score(input: ConfidenceInput, options?: { signal?: AbortSignal }): Promise<unknown>;
}
