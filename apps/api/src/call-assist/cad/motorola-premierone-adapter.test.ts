import { describe, expect, it } from "vitest";
import { evaluateCadPushGate } from "./provider.js";
import { MotorolaPremierOneAdapter } from "./motorola-premierone-adapter.js";

describe("Motorola PremierOne Call Assist adapter", () => {
  it("stays fail-closed when CAD write-back is off", async () => {
    const gated = evaluateCadPushGate({
      cadWritebackEnabled: false,
      callAssistCadPushEnabled: true,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    expect(gated?.reason).toBe("cad_writeback_disabled");
    const adapter = new MotorolaPremierOneAdapter();
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

  it("does not claim a live CAD note update before UAT", async () => {
    const adapter = new MotorolaPremierOneAdapter();
    const result = await adapter.updateIncident("agency-1", "cad-1", "note", {
      humanReviewApproved: true,
      actorId: "u1",
    });
    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toMatch(/cad_writeback_disabled|call_assist_cad_push_disabled|premierone_update_requires_live_uat/);
  });

  it("never live-submits demo calls", async () => {
    const adapter = new MotorolaPremierOneAdapter();
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

  it("returns empty nearby and hazards until live CAD UAT is enabled", async () => {
    const adapter = new MotorolaPremierOneAdapter();
    const nearby = await adapter.findNearbyIncidents("agency-1", { text: "4200 Main" });
    const hazards = await adapter.getPremiseHazards("agency-1", { text: "4200 Oak" });
    expect(nearby).toEqual([]);
    expect(hazards).toEqual([]);
  });
});
