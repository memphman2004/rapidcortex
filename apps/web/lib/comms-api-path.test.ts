import { afterEach, describe, expect, it } from "vitest";
import {
  isCommsPlatformApiPath,
  isSam3ApiPath,
  isSam4ApiPath,
  isSam5ApiPath,
  isStack2ApiPath,
  resolveUpstreamApiBase,
} from "./comms-api-path";

describe("resolveUpstreamApiBase", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("routes billing to stack 4 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    process.env.API_UPSTREAM_BASE_4 = "https://stack4.example.com";
    process.env.API_UPSTREAM_BASE_5 = "https://stack5.example.com";
    expect(resolveUpstreamApiBase("/api/billing/plans")).toBe("https://stack4.example.com");
  });

  it("routes campus to stack 5 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_5 = "https://stack5.example.com";
    expect(resolveUpstreamApiBase("/api/campus/incidents")).toBe("https://stack5.example.com");
  });

  it("routes call-intelligence to stack 2 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(resolveUpstreamApiBase("/api/call-intelligence/languages")).toBe(
      "https://stack2.example.com",
    );
  });

  it("routes agency-admin to stack 3 only", () => {
    process.env.API_UPSTREAM_BASE = "https://stack1.example.com";
    process.env.API_UPSTREAM_BASE_2 = "https://stack2.example.com";
    process.env.API_UPSTREAM_BASE_3 = "https://stack3.example.com";
    expect(resolveUpstreamApiBase("/api/agency-admin/clients")).toBe(
      "https://stack3.example.com",
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
  it("matches billing prefix (stack 4)", () => {
    expect(isSam4ApiPath("/api/billing/plans")).toBe(true);
    expect(isStack2ApiPath("/api/billing/plans")).toBe(false);
  });

  it("matches campus prefix (stack 5)", () => {
    expect(isSam5ApiPath("/api/campus/analytics")).toBe(true);
    expect(isSam3ApiPath("/api/campus/analytics")).toBe(false);
  });

  it("matches call-intelligence prefix", () => {
    expect(isCommsPlatformApiPath("/api/call-intelligence/languages")).toBe(true);
  });

  it("matches agency-admin (stack 3)", () => {
    expect(isSam3ApiPath("/api/agency-admin/clients")).toBe(true);
    expect(isStack2ApiPath("/api/agency-admin/clients")).toBe(false);
  });

  it("does not match incident list", () => {
    expect(isCommsPlatformApiPath("/api/incidents")).toBe(false);
  });
});
