import { defaultPermissionForRole } from "rapid-cortex-security";
import { isRcInternalOperator, type UserRole } from "rapid-cortex-shared";

export function canViewCallAssist(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.session.view");
}

export function canAdminCallAssist(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.admin.config");
}

export function canCallAssistRecords(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.records.request");
}

export function canRunCallAssistDemo(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.demo.run");
}

export function canSetupCallAssist(role: string | undefined): boolean {
  return canAdminCallAssist(role);
}

/** Operational profile (911 / campus / venue) — Rapid Cortex operators only. */
export function canSetCallAssistVertical(role: string | undefined): boolean {
  if (!role) return false;
  return isRcInternalOperator(role);
}

/** Agency switcher panel — Rapid Cortex operators only. */
export function canSeeAgencySwitcher(role: string | undefined): boolean {
  if (!role) return false;
  return isRcInternalOperator(role);
}

export function canSetCallAssistShift(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.session.takeover");
}
