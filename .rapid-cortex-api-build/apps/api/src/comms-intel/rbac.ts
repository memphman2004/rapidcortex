import {
  canUseCommandIntelligence,
  canUseContextCards,
  canUseNexiqVault,
  migrateLegacyRapidCortexRoleTokenValue,
  normalizeSessionRole,
  type UserContext,
} from "rapid-cortex-shared";
import { TenantEntitlementsRepository } from "../repositories/tenantEntitlementsRepository.js";
import { env } from "../lib/env.js";

const entitlementsRepo = new TenantEntitlementsRepository();

function roleOf(user: UserContext): string {
  return migrateLegacyRapidCortexRoleTokenValue(normalizeSessionRole(user.role ?? "")) ?? "";
}

export function isContextCardViewer(user: UserContext): boolean {
  const r = roleOf(user);
  return (
    r === "dispatcher" ||
    r === "supervisor" ||
    r === "agencyadmin" ||
    r === "agencyit" ||
    r === "rcsuperadmin" ||
    r === "rcadmin" ||
    r === "campus_security" ||
    r === "campus_dispatch" ||
    r === "campus_admin" ||
    r === "campus_supervisor"
  );
}

export function isContextCardAdmin(user: UserContext): boolean {
  const r = roleOf(user);
  return r === "agencyadmin" || r === "agencyit" || r === "rcsuperadmin" || r === "rcadmin";
}

export function isCommandViewer(user: UserContext): boolean {
  const r = roleOf(user);
  return (
    r === "supervisor" ||
    r === "agencyadmin" ||
    r === "agencyit" ||
    r === "analyst" ||
    r === "rcsuperadmin" ||
    r === "rcadmin"
  );
}

export function isCommandExporter(user: UserContext): boolean {
  return isContextCardAdmin(user);
}

export function isVaultSearcher(user: UserContext): boolean {
  return isContextCardViewer(user) || roleOf(user) === "analyst";
}

export function isVaultAdmin(user: UserContext): boolean {
  return isContextCardAdmin(user);
}

export async function resolveEntitlements(user: UserContext) {
  const agencyId = user.agencyId?.trim() ?? "";
  if (!agencyId) {
    return { plan: "essential", addons: undefined as undefined };
  }
  const ent = await entitlementsRepo.resolveForRead(agencyId, user.email ?? user.userId);
  return { plan: ent.plan, addons: ent.addons };
}

export async function assertContextCardsEntitled(user: UserContext): Promise<boolean> {
  if (!env.enableContextCards) return false;
  const { plan, addons } = await resolveEntitlements(user);
  return canUseContextCards(plan, addons);
}

export async function assertCommandEntitled(user: UserContext): Promise<boolean> {
  if (!env.enableCommandIntelligence) return false;
  const { plan, addons } = await resolveEntitlements(user);
  return canUseCommandIntelligence(plan, addons);
}

export async function assertVaultEntitled(user: UserContext): Promise<boolean> {
  if (!env.enableNexiqVault) return false;
  const { plan, addons } = await resolveEntitlements(user);
  return canUseNexiqVault(plan, addons);
}

export async function vaultEnrichmentAllowed(user: UserContext): Promise<boolean> {
  try {
    return await assertVaultEntitled(user);
  } catch {
    return false;
  }
}
