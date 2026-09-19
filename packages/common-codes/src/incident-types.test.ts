import { describe, expect, it } from "vitest";
import {
  COMMON_INCIDENT_TYPES,
  isTypicalMutualAid,
  listIncidentTypes,
  lookupIncidentType,
} from "./index";

describe("@rc/common-codes", () => {
  it("has unique codes", () => {
    const codes = COMMON_INCIDENT_TYPES.map((row) => row.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("looks up by hub code and CAD alias", () => {
    expect(lookupIncidentType("STRFIRE")?.label).toBe("Structure Fire");
    expect(lookupIncidentType("structure fire")?.code).toBe("STRFIRE");
    expect(lookupIncidentType("PI ACCIDENT")?.code).toBe("MVAINJ");
    expect(lookupIncidentType("CHASE")?.code).toBe("PURSUIT");
  });

  it("returns undefined for unknown types", () => {
    expect(lookupIncidentType("")).toBeUndefined();
    expect(lookupIncidentType("not-a-real-call-type")).toBeUndefined();
  });

  it("filters by discipline", () => {
    const fire = listIncidentTypes("fire");
    expect(fire.every((row) => row.discipline === "fire")).toBe(true);
    expect(fire.some((row) => row.code === "STRFIRE")).toBe(true);
    expect(listIncidentTypes()).toHaveLength(COMMON_INCIDENT_TYPES.length);
  });

  it("flags typical mutual-aid types used on the Berkeley→Charleston demo", () => {
    expect(isTypicalMutualAid("STRUCTURE FIRE")).toBe(true);
    expect(isTypicalMutualAid("CARDIAC ARREST")).toBe(true);
    expect(isTypicalMutualAid("TRAFFIC STOP")).toBe(false);
  });
});
