import { describe, expect, it } from "vitest";
import { defaultCallAssistRoutingRules, evaluateCallAssistRouting } from "./routing-rules.js";
import {
  MUNICIPAL_DEPARTMENTS,
  MUNICIPAL_ISSUES,
  SERVICE_CODE_DEPARTMENT,
  classifyMunicipalIssue,
} from "./municipal-services.js";

const rules = defaultCallAssistRoutingRules("city");

function route(utterance: string, incidentType?: string) {
  return evaluateCallAssistRouting({
    agencyId: "city",
    confirmationNumber: "CITY-1001",
    incidentType,
    utterance,
    createdAt: "2026-10-01T14:30:00.000Z",
    rules,
  });
}

describe("city service routing", () => {
  it("covers every department a US city caller is sent to", () => {
    const used = new Set(MUNICIPAL_ISSUES.map((item) => item.departmentId));
    for (const departmentId of Object.values(SERVICE_CODE_DEPARTMENT)) used.add(departmentId);
    for (const departmentId of MUNICIPAL_DEPARTMENTS) {
      expect(used.has(departmentId)).toBe(true);
    }
  });

  it.each([
    ["there is a pothole on main", "PUBLIC_WORKS"],
    ["they missed the garbage this morning", "SANITATION"],
    ["the streetlight is out", "PUBLIC_WORKS_ELECTRICAL"],
    ["the traffic light is out", "PUBLIC_WORKS_ELECTRICAL"],
    ["water main break at the corner", "WATER_SEWER_AUTHORITY"],
    ["the storm drain is clogged", "WATER_SEWER_AUTHORITY"],
    ["there is a boil water notice", "WATER_SEWER_AUTHORITY"],
    ["the street was not plowed", "PUBLIC_WORKS"],
    ["we need hurricane debris picked up", "SANITATION"],
    ["the watering restriction started today", "WATER_SEWER_AUTHORITY"],
    ["a stray dog is in the yard", "ANIMAL_CONTROL"],
    ["the dog wont stop barking", "ANIMAL_CONTROL"],
    ["there is a loud party next door", "POLICE_NON_EMERGENCY"],
    ["construction noise started at six", "CODE_ENFORCEMENT"],
    ["there is an encampment on the sidewalk", "SOCIAL_SERVICES"],
    ["how do I register to vote", "ELECTIONS"],
    ["I need a birth certificate", "CITY_CLERK"],
    ["what are the library hours", "LIBRARY"],
    ["I have jury duty tomorrow", "COURTS"],
    ["the bus stop bench is broken", "TRANSIT_AUTHORITY"],
    ["the parking meter is broken", "PARKING_ENFORCEMENT"],
    ["my water bill is too high", "TAX_FINANCE"],
    ["the stop sign is down", "PUBLIC_WORKS"],
    ["a tree is down in the park", "URBAN_FORESTRY"],
    ["the playground swing is broken", "PARKS_RECREATION"],
    ["the landlord has no heat in my apartment", "HOUSING_COMMUNITY_DEV"],
    ["there are rats behind the restaurant", "ENVIRONMENTAL_QUALITY"],
    ["the fire hydrant is blocked by a car", "FIRE_MARSHAL_NON_EMERGENCY"],
    ["there is a power outage on my block", "UTILITIES"],
    ["I need sharps disposal", "SANITATION"],
    ["the ferry schedule changed", "TRANSIT_AUTHORITY"],
    ["I need an absentee ballot", "ELECTIONS"],
    ["hazardous household waste pickup", "SANITATION"],
  ])("%s goes to %s", (utterance, departmentId) => {
    const result = route(utterance);
    expect(result.departmentId).toBe(departmentId);
    expect(result.fallback).toBe(false);
  });

  it("does not file a work order for a downed wire or a tree on a power line", () => {
    expect(route("there is a downed wire in the alley").departmentId).toBe("ESCALATE_911");
    expect(route("a tree is on the power line").departmentId).toBe("ESCALATE_911");
    expect(route("I smell gas in the house").departmentId).toBe("ESCALATE_911");
  });

  it("keeps the existing patrol rule and the supervisor fallback", () => {
    expect(route("", "SUSPICIOUS_VEHICLE").departmentId).toBe("PATROL");
    expect(route("nothing we recognize", "UNKNOWN_TYPE_XYZ").departmentId).toBe("SUPERVISOR");
  });

  it("routes a Lex category and a service code when the caller was not more specific", () => {
    expect(route("", "ReportSanitationWaste").departmentId).toBe("SANITATION");
    expect(route("", "POTHOLE").departmentId).toBe("PUBLIC_WORKS");
    expect(route("", "DOG_BARKING").departmentId).toBe("ANIMAL_CONTROL");
    expect(route("", "EXPOSED_WIRING_ON_POLE").departmentId).toBe("ESCALATE_911");
    expect(route("", "WATER_BILL_DISPUTE").departmentId).toBe("TAX_FINANCE");
    expect(route("", "PUBLIC_WORKS").departmentId).toBe("PUBLIC_WORKS");
  });

  it("lets the caller's words beat the category", () => {
    const result = route("the streetlight is out on the corner", "ReportRoadsInfrastructure");
    expect(result.departmentId).toBe("PUBLIC_WORKS_ELECTRICAL");
    expect(result.issueId).toBe("STREETLIGHT");
  });

  it("names a northern snow call and a gulf debris call", () => {
    expect(classifyMunicipalIssue("please salt the road")?.issueId).toBe("SNOW_PLOW");
    expect(classifyMunicipalIssue("hurricane debris is still in the yard")?.issueId).toBe("STORM_DEBRIS");
  });

  it("keeps a known city issue ahead of the longer citizen reason list", () => {
    expect(classifyMunicipalIssue("there is a pothole on main")?.issueId).toBe("POTHOLE");
    expect(classifyMunicipalIssue("I have a complaint")?.issueId).toBeUndefined();
  });
});
