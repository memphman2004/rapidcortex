import { describe, expect, it } from "vitest";
import {
  applyIncidentPictureFacts,
  blankPictureAnalysis,
  callHasWeaponSignal,
  incidentPictureRationale,
  pictureFromIncidentFacts,
} from "./incident-facts.js";

const shotsFired = {
  title: "Shots Fired — Kings Lake Ct NE, Atlanta, GA, 30345, USA",
  callerAddressLine: "Kings Lake Ct NE, Atlanta, GA, 30345, USA",
  cadLocation: "Kings Lake Ct NE, Atlanta, GA, 30345, USA",
  cadNatureCode: "SHOTS",
  category: "police",
};

describe("incident picture facts", () => {
  it("recognizes a shots-fired call", () => {
    expect(callHasWeaponSignal("shots fired near the school")).toBe(true);
    expect(callHasWeaponSignal("the dog is barking")).toBe(false);
  });

  it("fills location, type, and weapon from the incident and asks about the next gap", () => {
    const picture = pictureFromIncidentFacts({
      incidentId: "inc-1",
      agencyId: "test-agency",
      source: shotsFired,
    });
    expect(picture).not.toBeNull();
    const location = picture?.fields.find((field) => field.field === "location");
    const incidentType = picture?.fields.find((field) => field.field === "incidentType");
    const weapons = picture?.fields.find((field) => field.field === "weapons");
    expect(location?.value).toContain("Kings Lake Ct NE");
    expect(location?.level).not.toBe("MISSING");
    expect(incidentType?.value).toBe("Shots Fired");
    expect(weapons?.value).toBe("Shots Fired");
    expect(weapons?.suggestedQuestion).toMatch(/weapon/i);
    expect(picture?.aggregate.overallScore).toBeGreaterThan(0);
    expect(picture?.aggregate.pictureStatus).toBe("INCOMPLETE");
    expect(picture?.aggregate.topSuggestedQuestion).toMatch(/injured/i);
    expect(picture?.aggregate.topSuggestedQuestion).not.toMatch(/address/i);
  });

  it("keeps a transcript location and a conflict", () => {
    const blank = blankPictureAnalysis({ incidentId: "inc-1", agencyId: "test-agency", version: 2, segmentCount: 6 });
    const withCaller = {
      ...blank,
      fields: blank.fields.map((field) =>
        field.field === "location"
          ? { ...field, value: "123 Main St", score: 88, level: "HIGH" as const }
          : field.field === "incidentType"
            ? { ...field, level: "CONFLICT" as const, value: "robbery", conflictingValues: ["robbery", "medical"] }
            : field,
      ),
    };
    const next = applyIncidentPictureFacts(withCaller, shotsFired);
    expect(next.fields.find((field) => field.field === "location")?.value).toBe("123 Main St");
    expect(next.fields.find((field) => field.field === "incidentType")?.level).toBe("CONFLICT");
  });

  it("replaces the empty triage fallback when the incident already has facts", () => {
    const rationale = incidentPictureRationale("Insufficient signal for high-confidence classification.", shotsFired);
    expect(rationale).toMatch(/Shots Fired/);
    expect(rationale).toMatch(/Kings Lake Ct NE/);
    expect(rationale).not.toMatch(/Insufficient signal/);
    expect(incidentPictureRationale("Caller confirmed a robbery in progress.", shotsFired)).toMatch(/robbery/);
  });

  it("does not invent a location from a city name alone", () => {
    expect(
      pictureFromIncidentFacts({
        incidentId: "inc-2",
        agencyId: "test-agency",
        source: { title: "Unknown", callerAddressLine: "Atlanta", category: "unknown" },
      }),
    ).toBeNull();
  });
});
