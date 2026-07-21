import type { AiRuntimeConfig } from "../../ai/aiConfig.js";
import { modelForTier, type AiProviderKindName } from "../../ai/aiConfig.js";
import type { ResolvedAiSecrets } from "../../ai/aiProviderFactory.js";
import type { IConfidenceAiProvider } from "./confidenceProvider.js";
import { ConfidenceOpenAiAdapter } from "./providers/confidenceOpenAiAdapter.js";
import { ConfidenceAnthropicAdapter } from "./providers/confidenceAnthropicAdapter.js";
import { ConfidenceBedrockAdapter } from "./providers/confidenceBedrockAdapter.js";
import { ConfidenceMockAdapter } from "./providers/confidenceMockAdapter.js";

function tierAdapterName(kind: AiProviderKindName, tier: 0 | 1 | 2): string {
  const label = tier === 0 ? "primary" : tier === 1 ? "secondary" : "tertiary";
  return `confidence-${kind}-${label}`;
}

export function buildConfidenceProviderForTier(
  kind: AiProviderKindName,
  tier: 0 | 1 | 2,
  cfg: AiRuntimeConfig,
  secrets: ResolvedAiSecrets,
): IConfidenceAiProvider | null {
  if (kind === "off") return null;
  if (kind === "mock") {
    return new ConfidenceMockAdapter({ adapterName: tierAdapterName("mock", tier) });
  }
  const model = modelForTier(kind, tier, cfg);
  if (kind === "openai") {
    return new ConfidenceOpenAiAdapter({
      adapterName: tierAdapterName("openai", tier),
      model,
      apiKey: secrets.openaiApiKey,
      baseUrl: cfg.openai.baseUrl,
    });
  }
  if (kind === "anthropic") {
    return new ConfidenceAnthropicAdapter({
      adapterName: tierAdapterName("anthropic", tier),
      model,
      apiKey: secrets.anthropicApiKey,
      baseUrl: cfg.anthropic.baseUrl,
    });
  }
  if (kind === "bedrock") {
    return new ConfidenceBedrockAdapter({
      adapterName: tierAdapterName("bedrock", tier),
      modelId: model,
      region: cfg.bedrock.region,
    });
  }
  return null;
}

export function buildConfidenceProviderChain(
  cfg: AiRuntimeConfig,
  secrets: ResolvedAiSecrets,
): IConfidenceAiProvider[] {
  const kinds: AiProviderKindName[] = cfg.enableFallbacks
    ? [cfg.primaryProvider, cfg.secondaryProvider, cfg.tertiaryProvider]
    : [cfg.primaryProvider];

  const out: IConfidenceAiProvider[] = [];
  kinds.forEach((kind, idx) => {
    const tier = idx as 0 | 1 | 2;
    const p = buildConfidenceProviderForTier(kind, tier, cfg, secrets);
    if (p) out.push(p);
  });
  return out;
}
