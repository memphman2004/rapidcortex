import { z } from "zod";

/**
 * Licensed NexCort iQ modules. Extend this union as modules launch.
 * CAD access is stored on the agency record and resolved per request.
 * It is not a Cognito token claim.
 */
export const NEXCORTIQ_MODULES = ["CAD", "AI_ASSIST", "EVIDENCE_VAULT"] as const;
export type NexCortiQModule = (typeof NEXCORTIQ_MODULES)[number];

/**
 * FULL — dispatch and assign units.
 * READ_ONLY — view incidents and update unit status.
 * ADMIN — manage CAD configuration.
 */
export const CAD_SCOPES = ["FULL", "READ_ONLY", "ADMIN"] as const;
export type CadScope = (typeof CAD_SCOPES)[number];

export interface AgencyCADFeature {
  enabled: boolean;
  /** ISO-8601 */
  enabledAt?: string;
  /** Platform admin user id */
  enabledBy?: string;
  /** ISO-8601 */
  disabledAt?: string;
  disabledBy?: string;
  /** Contracted seat count set by a platform admin. */
  maxCadSeats: number;
}

export interface AgencyFeatures {
  cad?: AgencyCADFeature;
}

/** One user's licensed-module assignment. Keyed by Cognito username on the agency record. */
export interface CadUserGrant {
  username: string;
  /** Cognito sub when the caller has it. Seat matching also uses username and email. */
  userId?: string;
  email?: string;
  modules: NexCortiQModule[];
  cadScope?: CadScope | null;
  updatedAt?: string;
  updatedBy?: string;
}

export const patchAgencyCadModuleBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    maxCadSeats: z.number().int().min(1).max(500).optional(),
    confirmAgencyName: z.string().max(200).optional(),
  })
  .refine((body) => body.enabled !== undefined || body.maxCadSeats !== undefined, {
    message: "enabled or maxCadSeats is required",
  });

export type PatchAgencyCadModuleBody = z.infer<typeof patchAgencyCadModuleBodySchema>;

export const patchUserCadAccessBodySchema = z
  .object({
    enabled: z.boolean(),
    cadScope: z.enum(CAD_SCOPES).optional(),
    email: z.string().email().optional(),
  })
  .refine((body) => !body.enabled || body.cadScope !== undefined, {
    message: "cadScope is required when CAD is enabled",
  });

export type PatchUserCadAccessBody = z.infer<typeof patchUserCadAccessBodySchema>;

const FULL_ROLES = new Set([
  "DISPATCHER",
  "SUPERVISOR",
  "DISPATCH_SUPERVISOR",
  "DISPATCH_CENTER_ADMIN",
]);

const ADMIN_ROLES = new Set([
  "AGENCYADMIN",
  "AGENCY_ADMIN",
  "RCADMIN",
  "RCSUPERADMIN",
  "PLATFORM_ADMIN",
]);

/** Default CAD scope from the role being assigned. Unknown roles are read-only. */
export function defaultCadScope(role: string): CadScope {
  const token = role.trim().toUpperCase();
  if (FULL_ROLES.has(token)) return "FULL";
  if (ADMIN_ROLES.has(token)) return "ADMIN";
  return "READ_ONLY";
}

export function countCadSeats(grants: Record<string, CadUserGrant> | undefined | null): number {
  if (!grants) return 0;
  let count = 0;
  for (const grant of Object.values(grants)) {
    if (grant?.modules?.includes("CAD")) count += 1;
  }
  return count;
}

export function cadSeatsRemaining(
  feature: AgencyCADFeature | null | undefined,
  seatCount: number,
): number {
  if (!feature?.enabled) return 0;
  return Math.max(0, feature.maxCadSeats - seatCount);
}

export function userHasCadModule(grant: CadUserGrant | null | undefined): boolean {
  return grant?.modules?.includes("CAD") ?? false;
}

/** Both gates: the agency license is on, and this user still has a CAD seat. */
export function isCadConsoleVisible(
  feature: AgencyCADFeature | null | undefined,
  grant: CadUserGrant | null | undefined,
): boolean {
  return feature?.enabled === true && userHasCadModule(grant);
}

export function cadGrantForIdentity(
  grants: Record<string, CadUserGrant> | undefined | null,
  identity: { userId?: string; email?: string; cognitoUsername?: string },
): CadUserGrant | null {
  if (!grants) return null;
  const keys = [identity.cognitoUsername, identity.email, identity.userId].filter(
    (key): key is string => Boolean(key && key.trim()),
  );
  for (const key of keys) {
    const direct = grants[key];
    if (direct) return direct;
  }
  for (const grant of Object.values(grants)) {
    if (!grant) continue;
    if (identity.userId && grant.userId === identity.userId) return grant;
    if (identity.cognitoUsername && grant.username === identity.cognitoUsername) return grant;
    if (identity.email && (grant.email === identity.email || grant.username === identity.email)) {
      return grant;
    }
  }
  return null;
}

function namesMatch(typed: string | undefined, expected: string): boolean {
  const name = expected.trim().toLowerCase();
  if (!name) return false;
  return (typed ?? "").trim().toLowerCase() === name;
}

export type AgencyCadUpdateResult =
  | { feature: AgencyCADFeature; action: "enabled" | "disabled" | "seats" }
  | { error: "CONFIRM" | "SEAT_CAP" | "ENABLE_REQUIRED" };

/**
 * Next agency CAD block. Disabling does not remove user grants.
 * A disable while seats are assigned requires the agency name.
 */
export function nextAgencyCadFeature(input: {
  current: AgencyCADFeature | null;
  enabled?: boolean;
  maxCadSeats?: number;
  actorId: string;
  now: string;
  seatCount: number;
  confirmAgencyName?: string;
  agencyName: string;
}): AgencyCadUpdateResult {
  const current = input.current;
  const turningOn = input.enabled === true;
  const turningOff = input.enabled === false;
  const capOnly = input.enabled === undefined && input.maxCadSeats !== undefined;

  if (capOnly && current?.enabled !== true) {
    return { error: "ENABLE_REQUIRED" };
  }

  if (turningOff) {
    if (input.seatCount > 0 && !namesMatch(input.confirmAgencyName, input.agencyName)) {
      return { error: "CONFIRM" };
    }
    return {
      action: "disabled",
      feature: {
        enabled: false,
        enabledAt: current?.enabledAt,
        enabledBy: current?.enabledBy,
        disabledAt: input.now,
        disabledBy: input.actorId,
        maxCadSeats: current?.maxCadSeats ?? input.maxCadSeats ?? 1,
      },
    };
  }

  const maxCadSeats = input.maxCadSeats ?? current?.maxCadSeats ?? (turningOn ? 1 : undefined);
  if (maxCadSeats === undefined || maxCadSeats < 1) {
    return { error: "ENABLE_REQUIRED" };
  }
  if (maxCadSeats < input.seatCount) {
    return { error: "SEAT_CAP" };
  }

  if (turningOn || (capOnly && current?.enabled)) {
    return {
      action: turningOn && current?.enabled !== true ? "enabled" : capOnly ? "seats" : "enabled",
      feature: {
        enabled: true,
        enabledAt: current?.enabled === true ? current.enabledAt ?? input.now : input.now,
        enabledBy: current?.enabled === true ? current.enabledBy ?? input.actorId : input.actorId,
        disabledAt: current?.disabledAt,
        disabledBy: current?.disabledBy,
        maxCadSeats,
      },
    };
  }

  return { error: "ENABLE_REQUIRED" };
}

export type UserCadUpdateResult =
  | { grants: Record<string, CadUserGrant>; assigned: boolean }
  | { error: "CAD_DISABLED" | "SEAT_LIMIT" };

/** Next grant map. Assigning is refused when the agency license is off or the cap is full. */
export function nextCadUserGrants(input: {
  grants: Record<string, CadUserGrant>;
  username: string;
  email?: string;
  userId?: string;
  enabled: boolean;
  cadScope: CadScope;
  feature: AgencyCADFeature | null;
  now: string;
  actorId: string;
}): UserCadUpdateResult {
  const current = input.grants[input.username];
  const already = current?.modules?.includes("CAD") ?? false;
  if (input.enabled && input.feature?.enabled !== true) {
    return { error: "CAD_DISABLED" };
  }
  if (input.enabled && !already) {
    const max = input.feature?.maxCadSeats ?? 0;
    if (countCadSeats(input.grants) >= max) return { error: "SEAT_LIMIT" };
  }

  const modules = new Set<NexCortiQModule>(current?.modules ?? []);
  if (input.enabled) modules.add("CAD");
  else modules.delete("CAD");

  const next: CadUserGrant = {
    username: input.username,
    userId: input.userId ?? current?.userId,
    email: input.email ?? current?.email,
    modules: [...modules],
    cadScope: input.enabled ? input.cadScope : null,
    updatedAt: input.now,
    updatedBy: input.actorId,
  };
  return {
    assigned: input.enabled,
    grants: { ...input.grants, [input.username]: next },
  };
}
