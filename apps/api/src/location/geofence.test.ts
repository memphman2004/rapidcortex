import { describe, expect, it } from "vitest";
import { alsScopedId } from "rapid-cortex-shared";
import { geofencesForAgency, listAgencyGeofences } from "./geofence.js";

describe("geofencesForAgency", () => {
  it("keeps only geofences whose id starts with the agency prefix", () => {
    const agencyId = "test-agency";
    const mine = alsScopedId(agencyId, "north-zone");
    const other = alsScopedId("other-agency", "north-zone");
    const items = geofencesForAgency(agencyId, [
      {
        GeofenceId: mine,
        Geometry: {
          Polygon: [
            [
              [-84.4, 33.7],
              [-84.3, 33.7],
              [-84.3, 33.8],
              [-84.4, 33.8],
              [-84.4, 33.7],
            ],
          ],
        },
      },
      {
        GeofenceId: other,
        Geometry: {
          Polygon: [
            [
              [-94.6, 39.1],
              [-94.5, 39.1],
              [-94.5, 39.2],
              [-94.6, 39.2],
              [-94.6, 39.1],
            ],
          ],
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.zoneId).toBe("north-zone");
    expect(items[0]?.geofenceId).toBe(mine);
  });

  it("drops entries without a closed polygon", () => {
    const agencyId = "test-agency";
    const items = geofencesForAgency(agencyId, [
      { GeofenceId: alsScopedId(agencyId, "empty") },
      {
        GeofenceId: alsScopedId(agencyId, "line"),
        Geometry: { Polygon: [[[-84.4, 33.7], [-84.3, 33.7]]] },
      },
    ]);
    expect(items).toEqual([]);
  });
});

describe("listAgencyGeofences mock", () => {
  it("returns the Atlanta service-area fixture when ALS mock is on", async () => {
    const rows = await listAgencyGeofences("test-agency");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.zoneId).toBe("agency-service-area");
    expect(rows[0]?.polygon.length).toBeGreaterThanOrEqual(4);
  });
});
