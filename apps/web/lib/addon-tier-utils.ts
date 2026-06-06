import { ADDON_CATALOG, type AddonDefinition, type AddonKey } from "rapid-cortex-shared";

const TIER_SUFFIXES = new Set([
  "tier1",
  "tier2",
  "tier3",
  "tier4",
  "basic",
  "standard",
  "premium",
  "enterprise",
  "advanced",
  "full",
  "small",
  "medium",
  "large",
]);

/** Product family for tiered add-ons (e.g. `ai.triage` for `ai.triage.standard`). */
export function addonTierFamily(key: AddonKey): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1] ?? "";
  if (TIER_SUFFIXES.has(last) && parts.length > 2) {
    return parts.slice(0, -1).join(".");
  }
  return key;
}

export type AddonGridRow =
  | { kind: "single"; def: AddonDefinition }
  | { kind: "tiered"; family: string; variants: AddonDefinition[] };

export function buildAddonGridRows(catalog: AddonDefinition[] = ADDON_CATALOG): AddonGridRow[] {
  const byFamily = new Map<string, AddonDefinition[]>();
  for (const def of catalog) {
    const family = addonTierFamily(def.key);
    const list = byFamily.get(family) ?? [];
    list.push(def);
    byFamily.set(family, list);
  }

  const rows: AddonGridRow[] = [];
  for (const [family, variants] of byFamily) {
    if (variants.length > 1 && family !== variants[0]?.key) {
      variants.sort((a, b) => a.key.localeCompare(b.key));
      rows.push({ kind: "tiered", family, variants });
    } else {
      rows.push({ kind: "single", def: variants[0]! });
    }
  }
  return rows.sort((a, b) => {
    const catA = a.kind === "single" ? a.def.category : a.variants[0]?.category ?? "";
    const catB = b.kind === "single" ? b.def.category : b.variants[0]?.category ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    const nameA = a.kind === "single" ? a.def.name : a.family;
    const nameB = b.kind === "single" ? b.def.name : b.family;
    return nameA.localeCompare(nameB);
  });
}

export function activeTierKeyInFamily(
  family: string,
  variants: AddonDefinition[],
  addons: Record<AddonKey, { enabled?: boolean }>,
  plan: string,
  isIncluded: (def: AddonDefinition, plan: string) => boolean,
): AddonKey | "" {
  for (const def of variants) {
    if (isIncluded(def, plan)) return def.key;
    if (addons[def.key]?.enabled) return def.key;
  }
  return "";
}
