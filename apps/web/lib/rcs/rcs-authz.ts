/**
 * apps/web/lib/rcs/rcs-authz.ts
 *
 * Response Continuity System (RCS) — client-mirror RBAC.
 *
 * Mirrors the authorization shape the API is expected to enforce for `/api/rcs/*`
 * (agencyId-scoped, `AuthorizationService.canPerform()` at handler entry — see
 * `packages/security` and `.cursor/rules/rapid-cortex-global-features.mdc`). This module
 * intentionally avoids `AuthorizationService.canPerform()` directly for UI gating (role
 * checks below stay fast/sync). Permission keys are registered in
 * `packages/security/src/permissions.ts` (`rcs.call.manage`, `rcs.handoff.*`, etc.) for
 * API/AuthorizationService enforcement; keep these helpers aligned with
 * `apps/api/src/features/rcs/rcs-authz.ts`.
 *
 * Role notes:
 *  - `dispatcher` may manage (start/update/close) their own active RCS-monitored calls.
 *  - `supervisor` is the primary override/ack role for RCS alerts (silent monitor,
 *    supervisor acknowledgement, escalation closure).
 *  - `agencyadmin` and `rcsuperadmin` retain override access for agency oversight.
 *  - `commsupervisor` is a deprecated alias for `supervisor` — never branch on it here;
 *    `migrateLegacyRapidCortexRoleTokenValue()` normalizes it before these checks run.
 */

import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import type { UserContext } from "rapid-cortex-shared/types";

function normalizedRole(user: Pick<UserContext, "role">): string {
  const raw = String(user.role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw;
}

function sameAgency(user: Pick<UserContext, "agencyId">, agencyId: string): boolean {
  return Boolean(agencyId) && user.agencyId === agencyId;
}

/**
 * Start / update / close an RCS call session, post audio alerts, and post unit
 * positions. Dispatchers manage their own agency's calls; supervisors and agency
 * admins may act on behalf of their agency; `rcsuperadmin` and RC internal operators
 * (support diagnostics) always pass.
 */
export function canManageRcsCall(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (isRcInternalOperator(user.role)) return true;
  if (!sameAgency(user, agencyId)) return false;

  const role = normalizedRole(user);
  return (
    role === "dispatcher" ||
    role === "supervisor" ||
    role === "agencyadmin" ||
    role === "agencyit"
  );
}

/**
 * Supervisor override actions: silent-monitor trigger, supervisor acknowledgement of
 * an RCS alert, and forced closure of a call the dispatcher did not close. Dispatchers
 * are explicitly excluded — override is a supervisor-and-above action.
 */
export function canSupervisorOverride(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (isRcInternalOperator(user.role)) return true;
  if (!sameAgency(user, agencyId)) return false;

  const role = normalizedRole(user);
  return role === "supervisor" || role === "agencyadmin";
}

/** Read-only visibility into the RCS monitor panel (active calls list, supervisor strip). */
export function canViewRcsMonitor(user: UserContext, agencyId: string): boolean {
  if (isRcsuperadmin(user)) return true;
  if (isRcInternalOperator(user.role)) return true;
  if (!sameAgency(user, agencyId)) return false;

  const role = normalizedRole(user);
  return (
    role === "dispatcher" ||
    role === "supervisor" ||
    role === "agencyadmin" ||
    role === "agencyit" ||
    role === "analyst" ||
    role === "auditor"
  );
}

/** Soft handoff request — assigned dispatcher or supervisor+. */
export function canRequestSoftHandoff(
  user: UserContext,
  agencyId: string,
  assignedDispatcherId?: string,
): boolean {
  if (isRcsuperadmin(user)) return true;
  if (isRcInternalOperator(user.role)) return true;
  if (!sameAgency(user, agencyId)) return false;
  if (canSupervisorOverride(user, agencyId)) return true;
  if (!canManageRcsCall(user, agencyId)) return false;
  const role = normalizedRole(user);
  if (role === "dispatcher") {
    if (!assignedDispatcherId) return true;
    return user.userId === assignedDispatcherId;
  }
  return true;
}

/** Accept handoff — any monitor viewer who is not the requester. */
export function canAcceptSoftHandoff(
  user: UserContext,
  agencyId: string,
  requestedByUserId: string,
): boolean {
  if (!canViewRcsMonitor(user, agencyId)) return false;
  if (requestedByUserId && user.userId === requestedByUserId) return false;
  return true;
}

export function canManageEscalationRules(user: UserContext, agencyId: string): boolean {
  return canSupervisorOverride(user, agencyId);
}

export function canViewFloorHealth(user: UserContext, agencyId: string): boolean {
  return canSupervisorOverride(user, agencyId);
}
