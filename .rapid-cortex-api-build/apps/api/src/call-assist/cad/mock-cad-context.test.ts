import { describe, expect, it } from "vitest";
import { mockNearbyIncidents, mockPremiseHazards } from "./mock-cad-context.js";

describe("unconfigured CAD context", () => {
  it("does not invent nearby incidents", () => {
    expect(mockNearbyIncidents({ text: "4200 Oak Street" })).toEqual([]);
    expect(mockNearbyIncidents({ text: "" })).toEqual([]);
  });

  it("does not invent premise hazards", () => {
    expect(mockPremiseHazards({ text: "4200 Oak Street" })).toEqual([]);
    expect(mockPremiseHazards({ text: "" })).toEqual([]);
  });
});
