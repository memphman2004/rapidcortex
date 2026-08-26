import { describe, expect, it } from "vitest";
import { defaultFacilityLevelId, resolveVenueOperationalMap } from "./resolve-operational-map";
import { isMbsDemoVenue } from "./mbs-demo-map";

describe("resolveVenueOperationalMap", () => {
  it("loads the MBS illustrative demo catalog", () => {
    const map = resolveVenueOperationalMap("MBS");
    expect(map.isDemo).toBe(true);
    expect(map.name).toBe("Mercedes-Benz Stadium");
    expect(map.demoIncidents?.[0]?.id).toBe("INC-DEMO-001");
    expect(map.zones.some((z) => z.id === "section-124")).toBe(true);
    expect(isMbsDemoVenue("mercedes-benz-stadium")).toBe(true);
  });

  it("retitles the demo template for other venues without claiming MBS architecture", () => {
    const map = resolveVenueOperationalMap("arena-one", "Arena One");
    expect(map.isDemo).toBe(true);
    expect(map.venueId).toBe("ARENA-ONE");
    expect(map.name).toBe("Arena One");
    expect(map.demoIncidents?.[0]?.isDemo).toBe(true);
  });

  it("defaults interior focus to Level 1", () => {
    expect(defaultFacilityLevelId(resolveVenueOperationalMap("MBS"))).toBe("level-1");
  });
});
