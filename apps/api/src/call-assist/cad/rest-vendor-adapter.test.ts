import { describe, expect, it } from "vitest";
import { evaluateCadPushGate } from "./provider.js";
import { RestVendorCadAdapter } from "./rest-vendor-adapter.js";

describe("Call Assist CAD vendor adapters", () => {
  const vendors = ["tyler-new-world", "centralsquare", "hexagon-intergraph", "zetron"] as const;

  it.each(vendors)("%s stays fail-closed when write-back is off", async (id) => {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: false,
      callAssistCadPushEnabled: true,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    expect(gated?.reason).toBe("cad_writeback_disabled");
    const adapter = new RestVendorCadAdapter(id);
    const result = await adapter.createIncident(
      {
        agencyId: "agency-1",
        classification: "NOISE_COMPLAINT",
        intake: { locationText: "4200 Main" },
        location: { text: "4200 Main" },
      },
      { humanReviewApproved: true, actorId: "u1" },
    );
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/cad_writeback_disabled|call_assist_cad_push_disabled/);
  });

  it("never live-submits demo calls for CentralSquare", async () => {
    const adapter = new RestVendorCadAdapter("centralsquare");
    const result = await adapter.createIncident(
      {
        agencyId: "agency-1",
        classification: "PARKING",
        intake: {},
        location: {},
      },
      { humanReviewApproved: true, actorId: "u1", demo: true },
    );
    expect(result.cadIncidentId).toBe("demo_cad_not_live");
    expect(result.reason).toBe("demo_mock_cad");
  });
});
