import type { AiRuntimeConfig } from "./aiConfig.js";
import { modelForTier, type AiProviderKindName } from "./aiConfig.js";
import type { IAIProvider } from "./iaiProvider.js";
import { OpenAiAdapter } from "./providers/openaiAdapter.js";
import { AnthropicAdapter } from "./providers/anthropicAdapter.js";
import { BedrockAdapter } from "./providers/bedrockAdapter.js";
import { MockAdapter } from "./providers/mockAdapter.js";
import { resolvePlainOrSecretArn } from "../lib/runtimeSecrets.js";

export type ResolvedAiSecrets = {
  openaiApiKey: string;
  anthropicApiKey: string;
};

export async function resolveAiSecrets(cfg: AiRuntimeConfig): Promise<ResolvedAiSecrets> {
  const openaiApiKey = await resolvePlainOrSecretArn(
    process.env.OPENAI_API_KEY,
    cfg.openai.apiKeySecretArn || undefined,
  );
  const anthropicApiKey = await resolvePlainOrSecretArn(
    process.env.ANTHROPIC_API_KEY,
    cfg.anthropic.apiKeySecretArn || undefined,
  );
  return { openaiApiKey, anthropicApiKey };
}

function tierAdapterName(kind: AiProviderKindName, tier: 0 | 1 | 2): string {
  const label = tier === 0 ? "primary" : tier === 1 ? "secondary" : "tertiary";
  return `${kind}-${label}`;
}

export function buildProviderForTier(
  kind: AiProviderKindName,
  tier: 0 | 1 | 2,
  cfg: AiRuntimeConfig,
  secrets: ResolvedAiSecrets,
): IAIProvider | null {
  if (kind === "off") return null;
  if (kind === "mock") {
    return new MockAdapter({ adapterName: tierAdapterName("mock", tier) });
  }
  const model = modelForTier(kind, tier, cfg);
  if (kind === "openai") {
    return new OpenAiAdapter({
      adapterName: tierAdapterName("openai", tier),
      model,
      apiKey: secrets.openaiApiKey,
      baseUrl: cfg.openai.baseUrl,
    });
  }
  if (kind === "anthropic") {
    return new AnthropicAdapter({
      adapterName: tierAdapterName("anthropic", tier),
      model,
      apiKey: secrets.anthropicApiKey,
      baseUrl: cfg.anthropic.baseUrl,
    });
  }
  if (kind === "bedrock") {
    return new BedrockAdapter({
      adapterName: tierAdapterName("bedrock", tier),
      modelId: model,
      region: cfg.bedrock.region,
    });
  }
  return null;
}

export function buildAnalysisProviderChain(
  cfg: AiRuntimeConfig,
  secrets: ResolvedAiSecrets,
): IAIProvider[] {
  const kinds: AiProviderKindName[] = cfg.enableFallbacks
    ? [cfg.primaryProvider, cfg.secondaryProvider, cfg.tertiaryProvider]
    : [cfg.primaryProvider];

  const out: IAIProvider[] = [];
  kinds.forEach((kind, idx) => {
    const tier = idx as 0 | 1 | 2;
    const p = buildProviderForTier(kind, tier, cfg, secrets);
    if (p) out.push(p);
  });
  return out;
}
