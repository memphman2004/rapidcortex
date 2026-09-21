import { describe, expect, it } from "vitest";
import {
  campusGuestAssistKnowledgeSchema,
  emptyCampusGuestAssistKnowledge,
  emptyTransitGuestAssistKnowledge,
  emptyVenueGuestAssistKnowledge,
  GUEST_ASSIST_KNOWLEDGE_FIELDS,
  mergeVenueGuestAssistKnowledge,
  transitGuestAssistKnowledgeSchema,
  venueGuestAssistKnowledgeSchema,
} from "./knowledge.js";

describe("guest assist knowledge packs", () => {
  it("parses empty objects into blank facts for each vertical", () => {
    expect(venueGuestAssistKnowledgeSchema.parse({})).toEqual(emptyVenueGuestAssistKnowledge());
    expect(campusGuestAssistKnowledgeSchema.parse({})).toEqual(emptyCampusGuestAssistKnowledge());
    expect(transitGuestAssistKnowledgeSchema.parse({})).toEqual(emptyTransitGuestAssistKnowledge());
  });

  it("keeps category keys aligned with Guest Assist topics", () => {
    expect(GUEST_ASSIST_KNOWLEDGE_FIELDS.venue.map((f) => f.key)).toEqual([
      "hoursOfOperation",
      "nonEmergencyPhone",
      "directions",
      "venue-info",
      "guest-svc",
      "lost-found",
      "issue",
      "general",
    ]);
    expect(GUEST_ASSIST_KNOWLEDGE_FIELDS.campus.map((f) => f.key)).toEqual([
      "hoursOfOperation",
      "nonEmergencyPhone",
      "directions",
      "student-svc",
      "safety",
      "issue",
      "events",
      "lost-found",
    ]);
    expect(GUEST_ASSIST_KNOWLEDGE_FIELDS.transit.map((f) => f.key)).toEqual([
      "hoursOfOperation",
      "nonEmergencyPhone",
      "trip-plan",
      "schedules",
      "fares",
      "access",
      "issue",
      "alerts",
    ]);
  });

  it("merges partial venue facts without dropping other keys", () => {
    const merged = mergeVenueGuestAssistKnowledge({
      directions: "Restrooms behind 112",
      extraIgnored: "nope",
    });
    expect(merged.directions).toBe("Restrooms behind 112");
    expect(merged.general).toBe("");
    expect(merged).not.toHaveProperty("extraIgnored");
  });
});
