import { describe, expect, it } from "vitest";
import { FourwindsClient } from "./client.js";

describe("FourwindsClient", () => {
  it("returns mock success when mock flag set", async () => {
    const client = new FourwindsClient({ baseUrl: "", apiKey: "k", mock: true });
    const result = await client.activateEmergency({
      incidentId: "job-1",
      title: "Test",
      body: "Body",
      severity: "INFO",
      scopes: [{ scopeType: "campus", scopeId: "main" }],
      html5FallbackUrl: "https://example.com/fallback.html",
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
    expect(result.html5FallbackIssued).toBe(true);
  });
});
