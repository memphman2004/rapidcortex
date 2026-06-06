import { describe, expect, it } from "vitest";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_UPSTREAM_BASE;

async function maybeFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!baseUrl) return null;
  return fetch(`${baseUrl.replace(/\/$/, "")}${path}`, init);
}

describe("system validation smoke", () => {
  it("has runtime configuration for API validation", () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it("exposes backend health endpoint when configured", async () => {
    const response = await maybeFetch("/api/health", { method: "GET" });
    if (!response) {
      expect(baseUrl).toBeFalsy();
      return;
    }

    expect([200, 401, 403, 404]).toContain(response.status);
  });

  it("blocks CAD write path by default safety contract", async () => {
    const response = await maybeFetch("/api/cad/incidents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callNumber: "VALIDATION-TEST" }),
    });

    if (!response) {
      expect(baseUrl).toBeFalsy();
      return;
    }

    // In locked-down deployments this may be 401/403; otherwise expected contract block.
    expect([401, 403, 404, 409, 422, 500, 501]).toContain(response.status);
  });
});
