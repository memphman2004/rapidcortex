import { describe, expect, it } from "vitest";
import {
  SALES_TERRITORY_ZONES,
  normalizeSalesTerritoryAssignments,
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
    ]);
    expect(SALES_TERRITORY_ZONES[5]?.primaryFocus).toContain("Emerging");
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
  });
});
