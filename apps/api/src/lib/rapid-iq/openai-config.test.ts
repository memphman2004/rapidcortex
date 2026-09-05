import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("rapidIq openai config", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.RAPIDIQ_AI_ENABLED;
    delete process.env.RAPID_IQ_AI_ENABLED;
    delete process.env.OPENAI_WEB_SEARCH_ENABLED;
    delete process.env.RAPIDIQ_WEB_SEARCH_ENABLED;
    delete process.env.RAPIDIQ_MODEL_CLASSIFICATION;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults AI on and web search off", async () => {
    const mod = await import("./openai-config.js");
    expect(mod.isRapidIqAiEnabled()).toBe(true);
    expect(mod.isRapidIqWebSearchEnabled()).toBe(false);
    expect(mod.rapidIqModelClassification()).toBe("gpt-4o-mini");
  });

  it("honors RAPIDIQ_AI_ENABLED=false", async () => {
    process.env.RAPIDIQ_AI_ENABLED = "false";
    const mod = await import("./openai-config.js");
    expect(mod.isRapidIqAiEnabled()).toBe(false);
  });

  it("honors OPENAI_WEB_SEARCH_ENABLED=true", async () => {
    process.env.OPENAI_WEB_SEARCH_ENABLED = "true";
    const mod = await import("./openai-config.js");
    expect(mod.isRapidIqWebSearchEnabled()).toBe(true);
  });
});
