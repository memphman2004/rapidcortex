import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getAiRuntimeConfig, modelForTier, resetAiRuntimeConfigCacheForTests } from "./aiConfig.js";

describe("getAiRuntimeConfig", () => {
  beforeEach(() => {
    resetAiRuntimeConfigCacheForTests();
    delete process.env.SECONDARY_PROVIDER;
    delete process.env.TERTIARY_PROVIDER;
    process.env.FALLBACK_PROVIDER = "openai";
    process.env.SECONDARY_FALLBACK_PROVIDER = "off";
    process.env.PRIMARY_PROVIDER = "mock";
    process.env.DEPLOYMENT_STAGE = "dev";
  });

  afterEach(() => {
    resetAiRuntimeConfigCacheForTests();
  });

  it("maps legacy FALLBACK_PROVIDER to secondary when SECONDARY_PROVIDER unset", () => {
    const cfg = getAiRuntimeConfig();
    expect(cfg.secondaryProvider).toBe("openai");
    expect(cfg.tertiaryProvider).toBe("off");
  });

  it("prefers explicit SECONDARY_PROVIDER over legacy", () => {
    process.env.SECONDARY_PROVIDER = "anthropic";
    resetAiRuntimeConfigCacheForTests();
    const cfg = getAiRuntimeConfig();
    expect(cfg.secondaryProvider).toBe("anthropic");
  });
});

describe("modelForTier", () => {
  it("returns tier-specific OpenAI models", () => {
    resetAiRuntimeConfigCacheForTests();
    process.env.OPENAI_MODEL_PRIMARY = "p";
    process.env.OPENAI_MODEL_SECONDARY = "s";
    process.env.OPENAI_MODEL_TERTIARY = "t";
    const cfg = getAiRuntimeConfig();
    expect(modelForTier("openai", 0, cfg)).toBe("p");
    expect(modelForTier("openai", 1, cfg)).toBe("s");
    expect(modelForTier("openai", 2, cfg)).toBe("t");
  });
});
