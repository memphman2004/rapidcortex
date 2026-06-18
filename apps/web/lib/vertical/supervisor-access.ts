import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

const CAMPUS_SUPERVISOR_ROLES = new Set(["CAMPUS_SUPERVISOR", "CAMPUS_ADMIN"]);
const VENUE_SUPERVISOR_ROLES = new Set(["VENUE_SUPERVISOR", "VENUE_ADMIN"]);

export function canCampusSupervisorOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  if (token.toLowerCase() === "agencyit") return true;
  return CAMPUS_SUPERVISOR_ROLES.has(token.toUpperCase());
}

export function canVenueSupervisorOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  if (token.toLowerCase() === "agencyit") return true;
  return VENUE_SUPERVISOR_ROLES.has(token.toUpperCase());
}
