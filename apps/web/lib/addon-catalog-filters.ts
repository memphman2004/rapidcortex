import type { AddonDefinition } from "rapid-cortex-shared";
import type { Vertical } from "@/lib/vertical";

export function isAddonVisibleForTenant(
  def: AddonDefinition,
  vertical: Vertical,
  featureFlags: Record<string, boolean> | undefined,
  manageAllAddons: boolean,
): boolean {
  if (manageAllAddons) return true;
  if (def.verticalRequired && def.verticalRequired !== vertical) return false;
  if (def.featureFlag && !featureFlags?.[def.featureFlag]) return false;
  return true;
}

export function filterAddonCatalogForTenant(
  catalog: AddonDefinition[],
  opts: {
    vertical: Vertical;
    featureFlags?: Record<string, boolean>;
    manageAllAddons?: boolean;
  },
): AddonDefinition[] {
  return catalog.filter((def) =>
    isAddonVisibleForTenant(def, opts.vertical, opts.featureFlags, Boolean(opts.manageAllAddons)),
  );
}

export function addonAvailabilityNote(
  def: AddonDefinition,
  vertical: Vertical,
  featureFlags: Record<string, boolean> | undefined,
): string | null {
  if (def.verticalRequired && def.verticalRequired !== vertical) {
    return `Typically for ${def.verticalRequired} tenants`;
  }
  if (def.featureFlag && !featureFlags?.[def.featureFlag]) {
    return `Feature flag ${def.featureFlag} is off for this tenant`;
  }
  return null;
}
