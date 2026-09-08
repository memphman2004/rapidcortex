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

/** Current-shift label on Call Assist chrome — same gate as admin config. */
export function canSetCallAssistShift(role: string | undefined): boolean {
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

export function canViewCallAssistQa(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.qa.view");
}

export function canReviewCallAssistQa(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.qa.review");
}

export function canViewCallAssistAnalytics(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.analytics.view");
}

export function canManageCallAssistRetention(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.retention.manage");
}

export function canManageCallAssistPrompts(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.prompts.manage");
}

export function canTakeOverCallAssistCallback(role: string | undefined): boolean {
  if (!role) return false;
  return (
    defaultPermissionForRole(role as UserRole, "call_assist.session.takeover") ||
    defaultPermissionForRole(role as UserRole, "call_assist.cad.push")
  );
}

export function canFileCallAssistRms(role: string | undefined): boolean {
  if (!role) return false;
  return defaultPermissionForRole(role as UserRole, "call_assist.cad.push");
}
