import { getUserRoleDisplayLabel } from "rapid-cortex-shared/auth/role-display";
import {
  isRapidCortexRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { UserRole } from "rapid-cortex-shared/types";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

export type { UserRole };

function effectiveRole(role: UserRole | string): string {
  return migrateLegacyRapidCortexRoleTokenValue(String(role).trim()) ?? String(role).trim();
}

/** RC Admin dashboard access (all platform roles). */
export function isPlatformAdmin(role: UserRole | string): boolean {
  return isRcInternalOperator(role);
}

export function isSupervisorOrAdmin(role: UserRole | string): boolean {
  const e = effectiveRole(role);
  return e === "supervisor" || e === "agencyadmin" || isRcInternalOperator(e);
}

export function isAdminRole(role: UserRole | string): boolean {
  const e = effectiveRole(role);
  return e === "agencyadmin" || e === "agencyit" || isSupervisorOrAdmin(e);
}

export function isAnalystRole(role: UserRole | string): boolean {
  return effectiveRole(role) === "analyst" || isAdminRole(role);
}

export function isAuditRole(role: UserRole | string): boolean {
  return effectiveRole(role) === "auditor" || isAnalystRole(role);
}

export function isDispatcherRole(role: UserRole | string): boolean {
  return effectiveRole(role) === "dispatcher" || isSupervisorOrAdmin(role);
}

export function normalizeRole(value: string | undefined): UserRole {
  const migrated = migrateLegacyRapidCortexRoleTokenValue(value?.trim()) ?? "";
  if (migrated && isRapidCortexRole(migrated)) return migrated;
  return "dispatcher";
}

export function formatUserRoleLabel(role: UserRole | undefined): string {
  return getUserRoleDisplayLabel(role);
}

export function isAuthConfigured(): boolean {
  return Boolean(
    (process.env.COGNITO_USER_POOL_ID?.trim() ||
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim()) &&
      (process.env.COGNITO_CLIENT_ID?.trim() ||
        process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim()),
  );
}

/**
 * **Login shell only** (Server Components with `dynamic = "force-dynamic"` on ECS): show the form when
 * either build-time `NEXT_PUBLIC_COGNITO_*` (CodeBuild / Docker builder) **or** runtime `COGNITO_*`
 * (task definition) is set. Operators sometimes deploy SSR with ECS env only — the old NEXT_PUBLIC‑only
 * check hid sign-in despite working `/api/auth/*` routes.
 *
 * Uses bracket lookups for `COGNITO_*` so the SSR bundle tends to read **live `process.env` on Node**
 * rather than compile-time substitutions.
 *
 * Hosted UI identifiers are public by design (`NEXT_PUBLIC_*`); `/api/auth/*` still resolves pool/client via `getCognitoClientId()`.
 */
export function isHostedUiAuthConfigured(): boolean {
  const poolFromRuntime = process.env["COGNITO_USER_POOL_ID"]?.trim();
  const clientFromRuntime = process.env["COGNITO_CLIENT_ID"]?.trim();
  const poolFromPublic = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID?.trim();
  const clientFromPublic = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID?.trim();
  return Boolean(
    (poolFromRuntime || poolFromPublic) && (clientFromRuntime || clientFromPublic),
  );
}
