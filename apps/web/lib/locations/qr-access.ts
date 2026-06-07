import type { UserContext } from "rapid-cortex-shared/types";
import { canManageQrLocations, canViewQrLocations } from "rapid-cortex-security";

export function userCanViewQrLocations(
  user: Pick<UserContext, "role" | "agencyId"> | null | undefined,
  agencyId?: string,
): boolean {
  if (!user?.agencyId?.trim()) return false;
  const target = (agencyId ?? user.agencyId).trim();
  if (!target) return false;
  return canViewQrLocations(user as UserContext, target);
}

export function userCanManageQrLocations(
  user: Pick<UserContext, "role" | "agencyId"> | null | undefined,
  agencyId?: string,
): boolean {
  if (!user?.agencyId?.trim()) return false;
  const target = (agencyId ?? user.agencyId).trim();
  if (!target) return false;
  return canManageQrLocations(user as UserContext, target);
}

export function roleMayAccessQrNav(role: string | undefined | null): boolean {
  const upper = (role ?? "").trim().toUpperCase();
  if (upper === "CAMPUS_ADMIN" || upper === "CAMPUS_SUPERVISOR" || upper === "CAMPUS_SECURITY") {
    return true;
  }
  if (upper === "VENUE_ADMIN" || upper === "VENUE_SUPERVISOR") {
    return true;
  }
  return false;
}
