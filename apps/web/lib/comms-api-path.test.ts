import { afterEach, describe, expect, it } from "vitest";
import { isCommsPlatformApiPath, resolveUpstreamApiBase } from "./comms-api-path";

describe("resolveUpstreamApiBase", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("routes call-intelligence to stack 2 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    expect(resolveUpstreamApiBase("/api/call-intelligence/languages")).toBe(
      "https://stack2.example.com",
    );
  });

  it("does not fall back to stack 1 when stack 2 is unset", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    delete process.env.API_UPSTREAM_BASE_2;
    expect(resolveUpstreamApiBase("/api/call-intelligence/languages")).toBe("");
  });

  it("uses stack 1 for non-comms paths", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    delete process.env.API_UPSTREAM_BASE_2;
    expect(resolveUpstreamApiBase("/api/incidents")).toBe("https://stack1.example.com");
  });
});

describe("isCommsPlatformApiPath", () => {
  it("matches call-intelligence prefix", () => {
    expect(isCommsPlatformApiPath("/api/call-intelligence/languages")).toBe(true);
  });

  it("does not match incident list", () => {
    expect(isCommsPlatformApiPath("/api/incidents")).toBe(false);
  });
});
