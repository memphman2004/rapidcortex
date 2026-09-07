import {
  AGENCY_ASSIGNABLE_ROLES,
  CAMPUS_ASSIGNABLE_ROLES,
  HOSPITAL_ASSIGNABLE_ROLES,
  RAPID_CORTEX_ROLES,
  TRANSIT_ASSIGNABLE_ROLES,
  type RapidCortexRole,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";

const RC_INTERNAL_ASSIGNABLE: RapidCortexRole[] = ["rcadmin", "rcitadmin"];

function actorToken(actorRole: UserRole | string): string {
  return String(actorRole).trim().toUpperCase().replace(/-/g, "_");
}

/** Roles shown in admin invite/create and edit dropdowns for the signed-in operator. */
export function provisionableRolesForActor(actorRole: UserRole | string): string[] {
  const actor = String(actorRole).trim();
  const token = actorToken(actorRole);
  if (actor === "rcsuperadmin") {
    return [...RAPID_CORTEX_ROLES];
  }
  if (actor === "rcadmin" || actor === "rcitadmin") {
    return [
      ...AGENCY_ASSIGNABLE_ROLES,
      ...HOSPITAL_ASSIGNABLE_ROLES,
      ...RC_INTERNAL_ASSIGNABLE,
    ];
  }
  if (actor === "agencyadmin") {
    return [...AGENCY_ASSIGNABLE_ROLES, ...HOSPITAL_ASSIGNABLE_ROLES];
  }
  if (token === "CAMPUS_ADMIN") {
    return [...CAMPUS_ASSIGNABLE_ROLES];
  }
  if (token === "TRANSIT_ADMIN") {
    return [...TRANSIT_ASSIGNABLE_ROLES];
  }
  return [...AGENCY_ASSIGNABLE_ROLES];
}
