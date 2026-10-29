import { classifyMunicipalIssue } from "rapid-cortex-shared";

/** Spoken desk names for a completed city-service report. */
const SPOKEN_DEPARTMENT: Record<string, string> = {
  PUBLIC_WORKS: "Public Works",
  PUBLIC_WORKS_ELECTRICAL: "Street Lighting",
  SANITATION: "Sanitation",
  WATER_SEWER_AUTHORITY: "Water",
  CODE_ENFORCEMENT: "Code Enforcement",
  PARKING_ENFORCEMENT: "Parking",
  ANIMAL_CONTROL: "Animal Control",
  URBAN_FORESTRY: "Urban Forestry",
  PARKS_RECREATION: "Parks",
  HOUSING_COMMUNITY_DEV: "Housing",
  ENVIRONMENTAL_QUALITY: "Environmental Health",
  POLICE_NON_EMERGENCY: "the non-emergency desk",
  FIRE_MARSHAL_NON_EMERGENCY: "the fire marshal",
  TRANSIT_AUTHORITY: "Transit",
  CITY_CLERK: "the city clerk",
  SOCIAL_SERVICES: "social services",
  THREE11_OPERATIONS: "city services",
  UTILITIES: "the utility",
  TAX_FINANCE: "the billing office",
  ELECTIONS: "elections",
  LIBRARY: "the library",
  COURTS: "the courts",
};

export type CityServiceRead = {
  issueId: string;
  issueLabel: string;
  departmentId: string;
  departmentLabel: string;
  emergency: boolean;
};

export function spokenMunicipalDepartment(departmentId: string): string {
  return SPOKEN_DEPARTMENT[departmentId] ?? "city services";
}

/** Turn a catalog id into something a caller can hear. */
export function spokenMunicipalIssue(issueId: string): string {
  return issueId.replace(/_/g, " ").toLowerCase();
}

/** Match a caller's words to a city desk. Gas, a downed wire, and a tree on a line stay emergencies. */
export function readCityService(text: string): CityServiceRead | null {
  const match = classifyMunicipalIssue(text);
  if (!match) return null;
  return {
    issueId: match.issueId,
    issueLabel: match.label ?? spokenMunicipalIssue(match.issueId),
    departmentId: match.departmentId,
    departmentLabel: spokenMunicipalDepartment(match.departmentId),
    emergency: match.emergencyRefer,
  };
}
