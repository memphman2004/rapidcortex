import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { canVenueSupervisorOps } from "@/lib/vertical/supervisor-access";

export function canVenueNotifications(role?: string): boolean {
  return canVenueSupervisorOps(role);
}

export function canVenueAgencyIt(role?: string): boolean {
  const token = (role ?? "").trim();
  if (!token) return false;
  if (isRcInternalOperator(token)) return true;
  return token.toLowerCase() === "agencyit";
}
