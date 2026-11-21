/**
 * Live Assist authorization helpers.
 *
 * Uses the same user-context shape as the rest of the iQ Vision platform.
 * Supervisors and agency admins can initiate coaching; dispatchers can view.
 */
import type { UserContext } from "../types.js";

/** Roles that can VIEW a Live Assist session (video + location, no coaching) */
export function canViewLiveAssist(user: UserContext, agencyId: string): boolean {
  if (user.role === "rcsuperadmin" || user.role === "rcadmin") return true;
  if (user.agencyId !== agencyId) return false;
  const r = String(user.role).toLowerCase();
  return (
    r === "dispatcher" ||
    r === "supervisor" ||
    r === "agencyadmin" ||
    r === "agencyit" ||
    r === "analyst" ||
    r === "auditor" ||
    r === "campus_admin" ||
    r === "campus_supervisor" ||
    r === "campus_dispatch" ||
    r === "campus_security" ||
    r === "transit_admin" ||
    r === "transit_supervisor" ||
    r === "transit_security" ||
    r === "transit_operator"
  );
}

/** Roles that can COACH an officer (requires separate two-way voice channel) */
export function canCoachLiveAssist(user: UserContext, agencyId: string): boolean {
  if (user.role === "rcsuperadmin") return true;
  if (user.agencyId !== agencyId) return false;
  const r = String(user.role).toLowerCase();
  return (
    r === "supervisor" ||
    r === "agencyadmin" ||
    r === "campus_supervisor" ||
    r === "campus_admin" ||
    r === "transit_supervisor" ||
    r === "transit_admin"
  );
}

/** Roles that can CONFIGURE providers, devices, and session policy */
export function canAdminLiveAssist(user: UserContext, agencyId: string): boolean {
  if (user.role === "rcsuperadmin") return true;
  if (user.agencyId !== agencyId) return false;
  const r = String(user.role).toLowerCase();
  return r === "agencyadmin" || r === "agencyit" || r === "campus_admin" || r === "transit_admin";
}

/** Roles that can MANAGE running sessions (start, end, transfer coaching) */
export function canManageLiveAssistSessions(user: UserContext, agencyId: string): boolean {
  return canCoachLiveAssist(user, agencyId);
}

/** Roles that can VIEW the audit trail */
export function canViewLiveAssistAudit(user: UserContext, agencyId: string): boolean {
  if (user.role === "rcsuperadmin" || user.role === "rcadmin") return true;
  if (user.agencyId !== agencyId) return false;
  const r = String(user.role).toLowerCase();
  return r === "auditor" || r === "agencyadmin" || r === "supervisor";
}
