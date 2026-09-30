import { describe, expect, it } from "vitest";
import {
  formatK12FollowUpAnswers,
  getK12FollowUpQuestions,
  getK12GroupForType,
  getK12TypesInGroup,
  K12_INCIDENT_GROUPS,
  K12_TYPE_TO_GROUP,
} from "./k12-intake.js";
import { getIncidentTypes, K12_INCIDENT_TYPES } from "./incident-types.js";

describe("K-12 intake groups", () => {
  it("defines eight parent categories", () => {
    expect(K12_INCIDENT_GROUPS).toHaveLength(8);
    expect(K12_INCIDENT_GROUPS.map((g) => g.id)).toEqual([
      "emergency_threats",
      "student_safety_wellness",
      "bullying_misconduct",
      "drugs_prohibited",
      "medical_health",
      "security_suspicious",
      "transport_facilities",
      "other_concerns",
    ]);
  });

  it("maps every catalog type into a parent group", () => {
    for (const type of K12_INCIDENT_TYPES) {
      expect(K12_TYPE_TO_GROUP[type.value], type.value).toBeTruthy();
      expect(getK12GroupForType(type.value)).toBe(K12_TYPE_TO_GROUP[type.value]);
    }
  });

  it("returns weapon and bullying follow-ups, with group fallbacks", () => {
    const weapon = getK12FollowUpQuestions("weapon_concern");
    expect(weapon.some((q) => q.id === "weapon_visible_now")).toBe(true);
    expect(weapon.some((q) => q.id === "weapon_type")).toBe(true);

    const bullying = getK12FollowUpQuestions("bullying");
    expect(bullying.some((q) => q.id === "people_involved")).toBe(true);
    expect(bullying.some((q) => q.id === "frequency")).toBe(true);

    const facility = getK12FollowUpQuestions("facility_hazard");
    expect(facility.length).toBeGreaterThan(0);
    expect(facility[0]?.id).toBe("location");
  });

  it("groups getIncidentTypes(k12) without dumping into one list helper", () => {
    const types = getIncidentTypes("k12");
    const emergency = getK12TypesInGroup(types, "emergency_threats");
    expect(emergency.map((t) => t.value)).toContain("weapon_concern");
    expect(emergency.map((t) => t.value)).toContain("active_threat");
    expect(emergency.every((t) => t.groupId === "emergency_threats")).toBe(true);
  });

  it("formats follow-up answers for the report message", () => {
    const text = formatK12FollowUpAnswers(
      { weapon_visible_now: true, weapon_type: "Knife", person_location: "Main hall" },
      getK12FollowUpQuestions("weapon_concern"),
    );
    expect(text).toContain("Is the weapon visible now?: Yes");
    expect(text).toContain("What type of weapon?: Knife");
    expect(text).toContain("Where is the person / weapon?: Main hall");
  });
});
