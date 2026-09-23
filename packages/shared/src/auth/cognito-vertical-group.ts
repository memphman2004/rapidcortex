import { PLATFORM_AGENCY_ID } from "../tenancy/constants.js";

/** Cognito groups used to organize users by product vertical (not a substitute for `custom:role` RBAC). */
export const COGNITO_VERTICAL_GROUPS = [
  "vertical_platform",
  "vertical_911",
  "vertical_campus",
  "vertical_venue",
  "vertical_transit",
  "vertical_hospital",
  "vertical_call_assist",
] as const;

export type CognitoVerticalGroup = (typeof COGNITO_VERTICAL_GROUPS)[number];

export const COGNITO_VERTICAL_GROUP_DESCRIPTIONS: Record<CognitoVerticalGroup, string> = {
  vertical_platform: "Platform — Rapid Cortex internal admin accounts",
  vertical_911: "911 PSAP — dispatchers, supervisors, agency admins, analysts",
  vertical_campus: "Campus safety — campus admins, security, dispatch, faculty",
  vertical_venue: "Venue security — venue admins, operators, supervisors",
  vertical_transit: "Transit security — transit safety personnel",
  vertical_hospital: "Hospital — hospital coordinators and staff",
  vertical_call_assist: "Call Assist — non-emergency AI intake (no 911 dispatcher console)",
};

/**
 * Map Cognito `custom:agencyId` / `custom:role` / email to a vertical origin group.
 * Keep in sync with `scripts/organize-cognito-by-vertical.sh`.
 */
export function cognitoVerticalGroupFromUser(input: {
  agencyId?: string | null;
  role?: string | null;
  email?: string | null;
}): CognitoVerticalGroup | null {
  const agencyId = (input.agencyId ?? "").trim();
  const role = (input.role ?? "").trim().toLowerCase();
  const email = (input.email ?? "").trim().toLowerCase();
  const agencyLc = agencyId.toLowerCase();

  if (agencyId === PLATFORM_AGENCY_ID || role.startsWith("rc")) {
    return "vertical_platform";
  }
  if (agencyLc.includes("campus") || role.startsWith("campus_")) {
    return "vertical_campus";
  }
  if (agencyLc.includes("venue") || role.startsWith("venue_")) {
    return "vertical_venue";
  }
  if (agencyLc.includes("transit") || role.startsWith("transit_")) {
    return "vertical_transit";
  }
  if (role.startsWith("call_assist_")) {
    return "vertical_call_assist";
  }
  if (
    agencyLc.includes("hospital") ||
    role.startsWith("hospital_") ||
    role === "hospitaladmin" ||
    role === "hospitalstaff"
  ) {
    return "vertical_hospital";
  }
  if (agencyId) {
    return "vertical_911";
  }
  return null;
}
