import { describe, expect, it } from "vitest";
import { applyArcGISAuth } from "./arcgisAuth.js";

describe("applyArcGISAuth", () => {
  it("puts API key in X-Esri-Authorization header, not the URL", () => {
    const url = "https://example.com/arcgis/rest/services/X/FeatureServer/0/query";
    const out = applyArcGISAuth(url, "test-api-key", "api_key");
    expect(out.url).toBe(url);
    expect(out.url).not.toContain("test-api-key");
    expect(out.headers).toEqual({ "X-Esri-Authorization": "apiKey test-api-key" });
  });

  it("uses Bearer Authorization for OAuth tokens", () => {
    const url = "https://example.com/FeatureServer/0/query";
    const out = applyArcGISAuth(url, "oauth-token", "oauth");
    expect(out.url).toBe(url);
    expect(out.headers).toEqual({ Authorization: "Bearer oauth-token" });
  });
});
