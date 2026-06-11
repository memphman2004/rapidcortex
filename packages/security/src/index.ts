import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";

function effective(role: UserRole | string): string {
  return migrateLegacyRapidCortexRoleTokenValue(String(role).trim()) ?? String(role).trim();
}

/**
 * Agency + platform JWT roles for product surfaces (canonical names).
 * Legacy JWT values normalize via {@link migrateLegacyRapidCortexRoleTokenValue}.
 */
export const ROLES: readonly UserRole[] = [
  "rcsuperadmin",
  "rcadmin",
  "rcitadmin",
  "agencyadmin",
  "agencyit",
  "supervisor",
  "dispatcher",
  "analyst",
  "auditor",
] as const;

/** Maps legacy Cognito `custom:role` values to canonical roles at JWT parse boundaries. */
export function normalizeLegacyRole(role: string): UserRole {
  return (migrateLegacyRapidCortexRoleTokenValue(role) ?? role) as UserRole;
}

// ─── Platform role checks ─────────────────────────────────────────────────────

/** Platform owner only — unrestricted cross-tenant access including financial data. */
export function isRcSuperAdmin(role: UserRole | string): boolean {
  return effective(role) === "rcsuperadmin";
}

/** @deprecated Prefer {@link isRcSuperAdmin} */
export const isRcsuperadminRole = isRcSuperAdmin;

/** RC operations staff — support visibility without financial revenue or destructive actions. */
export function isRcAdmin(role: UserRole | string): boolean {
  return effective(role) === "rcadmin";
}

/** RC internal IT — infrastructure and technical operations. */
export function isRcItAdmin(role: UserRole | string): boolean {
  return effective(role) === "rcitadmin";
}

/** Any Rapid Cortex internal staff account. */
export function isRcStaff(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "rcsuperadmin" || e === "rcadmin" || e === "rcitadmin";
}

/** RC Admin dashboard access (all platform roles; permission matrix differs by role). */
export function isPlatformAdmin(role: UserRole | string): boolean {
  return isRcStaff(role);
}

// ─── Agency role checks ───────────────────────────────────────────────────────

export function isAgencyAdmin(role: UserRole | string): boolean {
  return effective(role) === "agencyadmin";
}

export function isAgencyIt(role: UserRole | string): boolean {
  return effective(role) === "agencyit";
}

export function isSupervisor(role: UserRole | string): boolean {
  return effective(role) === "supervisor";
}

/** Supervisor, agency admin, and RC platform roles. */
export function isSupervisorOrAbove(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "supervisor" || isAgencyAdmin(e) || isRcStaff(e);
}

/** @deprecated Prefer {@link isSupervisorOrAbove} */
export const isSupervisorOrAdmin = isSupervisorOrAbove;

export function isAdminRole(role: UserRole | string): boolean {
  return isAgencyAdmin(role) || isAgencyIt(role) || isSupervisorOrAbove(role);
}

export function isDispatcherOrAbove(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "dispatcher" || isSupervisorOrAbove(e);
}

export function hasQaAccess(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "supervisor" || isAgencyAdmin(e) || isRcStaff(e);
}

export function hasAnalyticsAccess(role: UserRole | string): boolean {
  const e = effective(role);
  return (
    e === "analyst" ||
    e === "auditor" ||
    e === "supervisor" ||
    isAgencyAdmin(e) ||
    isRcStaff(e)
  );
}

export function hasAuditAccess(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "auditor" || isAgencyAdmin(e) || isAgencyIt(e) || isRcStaff(e);
}

/** Financial revenue totals — rcsuperadmin only (Role Access Matrix v2). */
export function hasFinancialAccess(role: UserRole | string): boolean {
  return isRcSuperAdmin(role);
}

export function canApproveCadWriteback(role: UserRole | string): boolean {
  const e = effective(role);
  return e === "supervisor" || isAgencyAdmin(e) || isRcStaff(e);
}

export function hasCrossTenantAccess(role: UserRole | string): boolean {
  return isRcStaff(role);
}

/** QA analyst surfaces plus elevated agency/platform roles. */
export function isAnalystRole(role: UserRole | string): boolean {
  return effective(role) === "analyst" || isAdminRole(role);
}

/** Read-only audit surfaces plus elevated agency/platform roles. */
export function isAuditRole(role: UserRole | string): boolean {
  return effective(role) === "auditor" || isAnalystRole(role);
}

/** Dispatcher operational surfaces plus supervisor/admin/platform tiers. */
export function isDispatcherRole(role: UserRole | string): boolean {
  return effective(role) === "dispatcher" || isSupervisorOrAbove(role);
}

export function canViewSensitiveData(role: UserRole | string): boolean {
  const e = effective(role);
  return isAdminRole(e) || e === "analyst";
}

export { AUDIT_EVENT_TYPES, type AuditEventTypeName } from "./audit-schema.js";
export { AuthorizationService } from "./authorization-service.js";
export {
  canCreateQrNfcCodes,
  canManageQrNfcCodes,
  canViewQrNfcCodes,
  canDeactivateQrNfcCodes,
  canDownloadQrNfcCodes,
  isQrNfcPlatformRole,
  resolveQrNfcAgencyId,
} from "./qr-nfc-access.js";
export {
  canManageSmsRouting,
  canViewSmsRouting,
} from "./sms-routing-access.js";
export { TenantAccessGuard } from "./tenant-access-guard.js";
export { AuditLogger, type SecurityAuditEvent } from "./audit-logger.js";
export { RetentionPolicyService, type RetentionPolicy } from "./retention-policy-service.js";
export { ComplianceConfigService, type ComplianceFeatureFlags } from "./compliance-config-service.js";
export {
  IntegrationSecurityPolicy,
  type IntegrationConnectorPolicy,
} from "./integration-security-policy.js";
export { CJIS_POLICY_CONFIG, type CjisPolicyConfig } from "./cjis-policy-config.js";
export { AgencyScopeResolver } from "./agency-scope-resolver.js";
export {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  RCITADMIN_CROSS_TENANT_PERMISSIONS,
  defaultPermissionForRole,
  isImmutableRolePermissionRole,
  isRcsuperadminOnlyPermission,
  isRcitadminCrossTenantPermission,
  roleMayDeleteTranscripts,
  type Permission,
} from "./permissions.js";
export {
  CAMPUS_ROLES,
  CAMPUS_ROLE_PERMISSIONS,
  VENUE_ROLES,
  VENUE_ROLE_PERMISSIONS,
  ROLE_ACCESS_MATRIX_V2,
  RCSUPERADMIN_ONLY_PERMISSIONS,
  canCampusRolePerform,
  canVenueRolePerform,
  isCampusRole,
  isVenueRole,
  type CampusRole,
  type VenueRole,
  type MatrixRole,
} from "./role-access-matrix-v2.js";
export { canManageQrLocations, canViewQrLocations } from "./qr-locations-access.js";
