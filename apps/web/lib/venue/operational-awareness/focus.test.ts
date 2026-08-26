import { describe, expect, it } from "vitest";
import { MBS_DEMO_OPERATIONAL_MAP } from "./mbs-demo-map";
import { demoIncidentsToMap, matchLiveIncidentToZone, resolveIncidentFocus } from "./focus";

describe("incident focus", () => {
  it("focuses the demo medical incident on level 2 / section 124", () => {
    const focus = resolveIncidentFocus(MBS_DEMO_OPERATIONAL_MAP, "INC-DEMO-001");
    expect(focus?.levelId).toBe("level-2");
    expect(focus?.zoneId).toBe("section-124");
    expect(focus?.exteriorCoordinates).toEqual([-84.4024, 33.7546]);
    expect(focus?.demo?.isDemo).toBe(true);
  });

  it("matches live incident labels onto demo zones", () => {
    const zone = matchLiveIncidentToZone(MBS_DEMO_OPERATIONAL_MAP, "Concourse C · Section 124");
    expect(zone?.id).toBe("section-124");
  });

  it("projects demo incidents onto the exterior map with coordinates", () => {
    const rows = demoIncidentsToMap(MBS_DEMO_OPERATIONAL_MAP);
    expect(rows[0]?.id).toBe("INC-DEMO-001");
    expect(rows[0]?.latitude).toBeDefined();
    expect(rows[0]?.longitude).toBeDefined();
  });
});
