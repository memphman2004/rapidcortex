import { describe, expect, it } from "vitest";
import { normalizeVenueSectionSummaries } from "./venue-dashboard-api";

describe("normalizeVenueSectionSummaries", () => {
  it("passes through dashboard summary rows", () => {
    expect(
      normalizeVenueSectionSummaries([
        {
          sectionId: "s1",
          sectionName: "Concourse C",
          gate: "C",
          level: "1",
          capacity: 200,
          incidentCount: 1,
          status: "alert",
        },
      ]),
    ).toEqual([
      {
        sectionId: "s1",
        sectionName: "Concourse C",
        gate: "C",
        level: "1",
        capacity: 200,
        incidentCount: 1,
        status: "alert",
      },
    ]);
  });

  it("maps CRUD { sections: VenueSection[] } payloads", () => {
    expect(
      normalizeVenueSectionSummaries({
        sections: [
          {
            id: "food-court",
            label: "Food Court",
            level: "Concourse",
            capacity: 80,
            zone: "C",
            status: "clear",
          },
        ],
      }),
    ).toEqual([
      {
        sectionId: "food-court",
        sectionName: "Food Court",
        gate: "C",
        level: "Concourse",
        capacity: 80,
        incidentCount: 0,
        status: "clear",
      },
    ]);
  });

  it("returns empty for unknown shapes", () => {
    expect(normalizeVenueSectionSummaries(null)).toEqual([]);
    expect(normalizeVenueSectionSummaries({})).toEqual([]);
    expect(normalizeVenueSectionSummaries({ sections: "nope" })).toEqual([]);
  });
});
