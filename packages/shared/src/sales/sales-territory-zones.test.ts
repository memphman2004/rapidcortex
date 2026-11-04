import { describe, expect, it } from "vitest";
import {
  SALES_TERRITORY_ZONES,
  normalizeSalesTerritoryAssignments,
  parseSalesTerritoryStates,
} from "./sales-territory-zones.js";

describe("SALES_TERRITORY_ZONES", () => {
  it("has six hiring-doc zones with expected state coverage", () => {
    expect(SALES_TERRITORY_ZONES).toHaveLength(6);
    expect(SALES_TERRITORY_ZONES.map((z) => z.id)).toEqual([
      "zone-1",
      "zone-2",
      "zone-3",
      "zone-4",
      "zone-5",
      "zone-6",
    ]);
    expect(SALES_TERRITORY_ZONES[0]?.states).toEqual([
      "TX",
      "GA",
      "NC",
      "TN",
      "SC",
      "AL",
      "AR",
      "KS",
      "MO",
      "LA",
    ]);
    expect(SALES_TERRITORY_ZONES[4]?.states).toEqual([]);
    expect(SALES_TERRITORY_ZONES[4]?.primaryRepresentative).toBe("Reserve");
    expect(SALES_TERRITORY_ZONES[5]?.primaryFocus).toBe("Emerging markets");
  });

  it("normalizes multi-assignee zones and drops duplicates", () => {
    const normalized = normalizeSalesTerritoryAssignments({
      zones: [
        {
          zoneId: "zone-1",
          assignees: [
            { userId: "a", email: "Ada@Nexcortiq.us", name: "Ada" },
            { userId: "b", email: "ada@nexcortiq.us", name: "Ada Dup" },
            { userId: "c", email: "bob@nexcortiq.us", name: "Bob" },
          ],
        },
      ],
    });
    const z1 = normalized.zones.find((z) => z.zoneId === "zone-1");
    expect(z1?.assignees).toHaveLength(2);
    expect(z1?.assignees.map((a) => a.email)).toEqual([
      "ada@nexcortiq.us",
      "bob@nexcortiq.us",
    ]);
    expect(normalized.zones).toHaveLength(6);
    expect(z1?.primaryRepresentative).toBe("Eric");
    expect(z1?.states).toContain("TX");
  });

  it("persists editable primary, focus, and states overrides", () => {
    const normalized = normalizeSalesTerritoryAssignments({
      zones: [
        {
          zoneId: "zone-1",
          assignees: [],
          primaryRepresentative: "Jordan",
          primaryFocus: "Transit only",
          states: ["tx", "ok", "XX", "tx"],
        },
        {
          zoneId: "zone-4",
          assignees: [],
          states: ["OK", "PA"],
        },
      ],
    });
    const z1 = normalized.zones.find((z) => z.zoneId === "zone-1");
    const z4 = normalized.zones.find((z) => z.zoneId === "zone-4");
    expect(z1?.primaryRepresentative).toBe("Jordan");
    expect(z1?.primaryFocus).toBe("Transit only");
    expect(z1?.states).toEqual(["TX", "OK"]);
    // OK claimed by zone-1 first; zone-4 keeps PA only
    expect(z4?.states).toEqual(["PA"]);
  });

  it("parseSalesTerritoryStates accepts CSV and drops invalid codes", () => {
    expect(parseSalesTerritoryStates("tx, ga; DC | zz")).toEqual(["TX", "GA", "DC"]);
  });
});
