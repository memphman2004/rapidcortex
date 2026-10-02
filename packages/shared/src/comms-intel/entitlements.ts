import { getAddonByKey, isAddonActiveForTenant } from "../billing/addon-catalog.js";
import type { AddonKey, TenantAddonState } from "../billing/addon-types.js";

export const COMMS_INTEL_ADDON_KEYS = {
  contextCards: "comms_intel.context_cards",
  commandIntelligence: "comms_intel.command_intelligence",
  nexiqVault: "comms_intel.nexiq_vault",
} as const satisfies Record<string, AddonKey>;

type AddonStateMap = Partial<Record<AddonKey, TenantAddonState | { enabled?: boolean; disabledAt?: string }>>;

function active(
  key: AddonKey,
  planLabel: string,
  addons: AddonStateMap | undefined,
): boolean {
  const def = getAddonByKey(key);
  return isAddonActiveForTenant(def, planLabel, addons?.[key]);
}

/** Included on all commercial plans unless explicitly opted out. */
export function canUseContextCards(
  planLabel: string,
  addons?: AddonStateMap,
): boolean {
  return active(COMMS_INTEL_ADDON_KEYS.contextCards, planLabel || "essential", addons);
}

export function canUseCommandIntelligence(
  planLabel: string,
  addons?: AddonStateMap,
): boolean {
  return active(COMMS_INTEL_ADDON_KEYS.commandIntelligence, planLabel, addons);
}

export function canUseNexiqVault(
  planLabel: string,
  addons?: AddonStateMap,
): boolean {
  return active(COMMS_INTEL_ADDON_KEYS.nexiqVault, planLabel, addons);
}
