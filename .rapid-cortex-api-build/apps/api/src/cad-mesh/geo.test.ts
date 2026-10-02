import { describe, expect, it } from "vitest";
import { incidentWithinMiles } from "./geo";

describe("incidentWithinMiles", () => {
  it("rejects a bounded policy when headquarters coordinates are missing", () => {
    expect(incidentWithinMiles(39.1, -94.5, 10, undefined, undefined)).toBe(false);
  });

  it("rejects an incident outside the mile radius", () => {
    expect(incidentWithinMiles(40.7, -74.0, 10, 39.1, -94.5)).toBe(false);
  });

  it("accepts an incident inside the mile radius", () => {
    expect(incidentWithinMiles(39.11, -94.58, 15, 39.1, -94.58)).toBe(true);
  });

  it("does not apply a boundary when miles are unset or zero", () => {
    expect(incidentWithinMiles(undefined, undefined, 0, undefined, undefined)).toBe(true);
  });
});
