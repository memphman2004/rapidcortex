import { describe, expect, it } from "vitest";
import { extractAnthropicApiKey } from "./guest-assist-anthropic";

describe("extractAnthropicApiKey", () => {
  it("reads a plain key", () => {
    expect(extractAnthropicApiKey(" sk-ant-test ")).toBe("sk-ant-test");
  });

  it("reads JSON injected by ECS Secrets", () => {
    expect(extractAnthropicApiKey(JSON.stringify({ apiKey: "sk-json" }))).toBe("sk-json");
    expect(extractAnthropicApiKey(JSON.stringify({ ANTHROPIC_API_KEY: "sk-field" }))).toBe("sk-field");
  });

  it("returns empty when missing", () => {
    expect(extractAnthropicApiKey(undefined)).toBe("");
    expect(extractAnthropicApiKey("{not-json")).toBe("");
  });
});
