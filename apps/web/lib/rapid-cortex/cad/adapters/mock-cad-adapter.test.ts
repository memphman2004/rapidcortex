import { describe, expect, it } from "vitest";
import { MockCadAdapter } from "@/lib/rapid-cortex/cad/adapters/mock-cad-adapter";

describe("MockCadAdapter", () => {
  it("supports health and incident lookup", async () => {
    const adapter = new MockCadAdapter(0);
    const health = await adapter.healthCheck();
    expect(health.ok).toBe(true);

    const incident = await adapter.getIncident("INC-1001");
    expect(incident.ok).toBe(true);
    expect(incident.data?.incidentId).toBe("INC-1001");
  });

  it("updates incident via mock write actions", async () => {
    const adapter = new MockCadAdapter(0);
    const noteResult = await adapter.addNarrativeNote("INC-1001", {
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      note: "Unit confirmed scene is secure.",
      createdBy: "user-1",
      createdAt: new Date().toISOString(),
    });
    expect(noteResult.ok).toBe(true);
    expect(noteResult.data?.narrative).toContain("Unit confirmed scene is secure.");

    const mediaResult = await adapter.attachMediaLink("INC-1001", {
      agencyId: "demo-agency",
      incidentId: "INC-1001",
      mediaUrl: "https://example.test/media/1",
      uploadedBy: "user-1",
      uploadedAt: new Date().toISOString(),
    });
    expect(mediaResult.ok).toBe(true);
    expect(mediaResult.data?.mediaUrls).toContain("https://example.test/media/1");
  });

  it("can simulate failures", async () => {
    const adapter = new MockCadAdapter(1);
    const result = await adapter.searchIncidents({ agencyId: "demo-agency", q: "INC" });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("MOCK_FAILURE");
  });
});
