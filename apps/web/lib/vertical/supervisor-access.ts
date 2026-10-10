import { campusRoleFamily } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

const VENUE_SUPERVISOR_ROLES = new Set(["VENUE_SUPERVISOR", "VENUE_ADMIN"]);
const TRANSIT_SUPERVISOR_ROLES = new Set(["TRANSIT_SUPERVISOR", "TRANSIT_ADMIN"]);
const TRANSIT_DISPATCH_ROLES = new Set([
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
]);

export function canCampusSupervisorOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  if (token.toLowerCase() === "agencyit") return true;
  const family = campusRoleFamily(token);
  return family === "admin" || family === "supervisor";
}

export function canVenueSupervisorOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  if (token.toLowerCase() === "agencyit") return true;
  return VENUE_SUPERVISOR_ROLES.has(token.toUpperCase());
}

export function canTransitSupervisorOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  if (token.toLowerCase() === "agencyit") return true;
  return TRANSIT_SUPERVISOR_ROLES.has(token.toUpperCase());
}

export function canTransitDispatchOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  return TRANSIT_DISPATCH_ROLES.has(token.toUpperCase());
}

export function canTransitAdminOps(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  return token.toUpperCase() === "TRANSIT_ADMIN" || token.toLowerCase() === "transit_admin";
}
