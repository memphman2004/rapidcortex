import { describe, expect, it } from "vitest";
import {
  joinUpstreamApiUrl,
  normalizeUpstreamApiBase,
  normalizeUpstreamApiPath,
} from "./upstream-url";

describe("normalizeUpstreamApiBase", () => {
  it("strips trailing slash and trailing /api", () => {
    expect(normalizeUpstreamApiBase("https://api.example.com/api")).toBe("https://api.example.com");
    expect(normalizeUpstreamApiBase("https://api.example.com/api/")).toBe("https://api.example.com");
    expect(normalizeUpstreamApiBase("https://api.example.com")).toBe("https://api.example.com");
  });
});

describe("normalizeUpstreamApiPath", () => {
  it("strips the Next.js BFF mount and keeps /api/agencies", () => {
    expect(normalizeUpstreamApiPath("/api/backend/api/agencies")).toBe("/api/agencies");
    expect(normalizeUpstreamApiPath("/api/agencies")).toBe("/api/agencies");
  });

  it("restores /api when the client omitted it after /api/backend", () => {
    expect(normalizeUpstreamApiPath("/api/backend/agencies")).toBe("/api/agencies");
    expect(normalizeUpstreamApiPath("/agencies")).toBe("/api/agencies");
  });

  it("collapses a doubled /api prefix", () => {
    expect(normalizeUpstreamApiPath("/api/api/agencies")).toBe("/api/agencies");
    expect(normalizeUpstreamApiPath("/api/backend/api/api/platform/summary")).toBe(
      "/api/platform/summary",
    );
  });
});

describe("joinUpstreamApiUrl", () => {
  it("does not double /api when the base already includes it", () => {
    expect(joinUpstreamApiUrl("https://internal.example.com/api", "/api/agencies").href).toBe(
      "https://internal.example.com/api/agencies",
    );
    expect(
      joinUpstreamApiUrl("https://internal.example.com/api", "/api/backend/api/agencies").href,
    ).toBe("https://internal.example.com/api/agencies");
  });

  it("appends /api when the base is origin-only", () => {
    expect(joinUpstreamApiUrl("https://cv1z1us095.execute-api.us-east-1.amazonaws.com", "/api/agencies").href).toBe(
      "https://cv1z1us095.execute-api.us-east-1.amazonaws.com/api/agencies",
    );
  });
});
