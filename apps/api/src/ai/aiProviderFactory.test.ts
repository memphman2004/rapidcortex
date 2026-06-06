import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildAnalysisProviderChain, resolveAiSecrets } from "./aiProviderFactory.js";
import { getAiRuntimeConfig, resetAiRuntimeConfigCacheForTests } from "./aiConfig.js";

describe("buildAnalysisProviderChain", () => {
  beforeEach(() => {
    resetAiRuntimeConfigCacheForTests();
    process.env.PRIMARY_PROVIDER = "mock";
    process.env.SECONDARY_PROVIDER = "mock";
    process.env.TERTIARY_PROVIDER = "mock";
    process.env.AI_ENABLE_FALLBACKS = "true";
  });

  afterEach(() => {
    resetAiRuntimeConfigCacheForTests();
  });

  it("builds three adapters when fallbacks enabled", async () => {
    const cfg = getAiRuntimeConfig();
    const secrets = await resolveAiSecrets(cfg);
    const chain = buildAnalysisProviderChain(cfg, secrets);
    expect(chain).toHaveLength(3);
    expect(chain.map((p) => p.adapterName)).toEqual([
      "mock-primary",
      "mock-secondary",
      "mock-tertiary",
    ]);
  });

  it("collapses to primary only when AI_ENABLE_FALLBACKS=false", async () => {
    process.env.AI_ENABLE_FALLBACKS = "false";
    resetAiRuntimeConfigCacheForTests();
    const cfg = getAiRuntimeConfig();
    const secrets = await resolveAiSecrets(cfg);
    const chain = buildAnalysisProviderChain(cfg, secrets);
    expect(chain).toHaveLength(1);
  });
});
