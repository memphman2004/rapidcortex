import {
  AGENCY_ASSIGNABLE_ROLES,
  CAMPUS_ASSIGNABLE_ROLES,
  HOSPITAL_ASSIGNABLE_ROLES,
  RAPID_CORTEX_ROLES,
  type RapidCortexRole,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";

const RC_INTERNAL_ASSIGNABLE: RapidCortexRole[] = ["rcadmin", "rcitadmin"];

/** Roles shown in admin invite/create and edit dropdowns for the signed-in operator. */
export function provisionableRolesForActor(actorRole: UserRole | string): string[] {
  const actor = String(actorRole).trim();
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
  if (actor === "CAMPUS_ADMIN") {
    return [...CAMPUS_ASSIGNABLE_ROLES];
  }
  return [...AGENCY_ASSIGNABLE_ROLES];
}
