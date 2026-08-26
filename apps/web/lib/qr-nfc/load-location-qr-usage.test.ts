import { describe, expect, it } from "vitest";
import { loadLocationQrUsage } from "./load-location-qr-usage";
import type { AgencyTenant, QRLocation } from "rapid-cortex-shared";

function loc(agencyId: string, rcli: string, scanCount: number): QRLocation {
  return {
    rcli,
    agencyId,
    orgCode: "TEST",
    vertical: "campus",
    locationName: rcli,
    zoneCode: "Z1",
    active: true,
    scanCount,
    createdBy: "test",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("loadLocationQrUsage", () => {
  it("loads a single agency when not in global view", async () => {
    const result = await loadLocationQrUsage(
      { globalView: false, agencyId: "campus-csu" },
      {
        fetchAgenciesFn: async () => {
          throw new Error("should not list agencies");
        },
        fetchLocationsFn: async (agencyId) => [loc(agencyId, "rcli-1", 7)],
      },
    );
    expect(result.agencyCount).toBe(1);
    expect(result.locations).toHaveLength(1);
    expect(result.locations[0]?.scanCount).toBe(7);
    expect(result.error).toBeUndefined();
  });

  it("fans out to campus and venue tenants in global view", async () => {
    const agencies = [
      { agencyId: "campus-csu", name: "CSU", type: "campus" },
      { agencyId: "venue-mbs", name: "MBS", type: "venue" },
      { agencyId: "psap-1", name: "PSAP", type: "city" },
    ] as AgencyTenant[];
    const result = await loadLocationQrUsage(
      { globalView: true, agencyId: "rc" },
      {
        fetchAgenciesFn: async () => agencies,
        fetchLocationsFn: async (agencyId) => {
          if (agencyId === "psap-1") throw new Error("should skip PSAP");
          return [loc(agencyId, `rcli-${agencyId}`, 1)];
        },
      },
    );
    expect(result.agencyCount).toBe(2);
    expect(result.locations.map((row) => row.agencyId).sort()).toEqual(["campus-csu", "venue-mbs"]);
  });
});
