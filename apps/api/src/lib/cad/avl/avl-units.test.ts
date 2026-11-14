import { describe, expect, it } from "vitest";
import { canViewCadAvl, filterAvlUnitsForAgency } from "./avl-units.js";

const now = Date.parse("2026-11-13T12:00:00.000Z");

describe("filterAvlUnitsForAgency", () => {
  it("scopes by agencyId and drops stale positions", () => {
    const rows = [
      {
        agencyId: "a1",
        unitId: "U1",
        latitude: 40,
        longitude: -80,
        timestamp: "2026-11-13T11:59:30.000Z",
        status: "available",
      },
      {
        agencyId: "a2",
        unitId: "U2",
        latitude: 41,
        longitude: -81,
        timestamp: "2026-11-13T11:59:30.000Z",
      },
      {
        agencyId: "a1",
        unitId: "U3",
        latitude: 40.1,
        longitude: -80.1,
        timestamp: "2026-11-13T11:50:00.000Z",
      },
    ];
    const out = filterAvlUnitsForAgency(rows, "a1", { staleAfterSeconds: 120, nowMs: now });
    expect(out.map((u) => u.unitId)).toEqual(["U1"]);
  });
});

describe("canViewCadAvl", () => {
  it("allows dispatcher/supervisor only among PSAP floor roles", () => {
    expect(canViewCadAvl("dispatcher")).toBe(true);
    expect(canViewCadAvl("supervisor")).toBe(true);
    expect(canViewCadAvl("agencyadmin")).toBe(false);
    expect(canViewCadAvl("agencyit")).toBe(false);
    expect(canViewCadAvl("analyst")).toBe(false);
  });
});
