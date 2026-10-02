import { describe, expect, it } from "vitest";

import { getCadWriteAdapter } from "./index.js";
import type { Incident } from "rapid-cortex-shared";

function demoIncident(): Incident {
  return {
    incidentId: "inc_demo",
    agencyId: "test-agency",
    title: "demo",
    category: "unknown",
    urgency: "high",
    status: "active",
    source: "demo",
    confidence: null,
    escalationFlag: false,
    summary: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDemoIncident: true,
    dispatchBlocked: true,
  };
}

describe("CAD write adapter demo guard", () => {
  it("returns mock success and does not throw for demo incidents", async () => {
    const adapter = getCadWriteAdapter("generic_webhook");
    const result = await adapter.submit({
      incident: demoIncident(),
      payload: { narrative: "demo" },
      config: {},
      cadIncidentId: "CAD-1",
    });
    expect(result.success).toBe(true);
    expect(result.cadResponse).toBe("demo-blocked");
  });
});
