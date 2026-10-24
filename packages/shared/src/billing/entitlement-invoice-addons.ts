/**
 * Products turned on for an agency are the add-on lines on the automatic monthly invoice.
 * Plan-included products stay in the plan fee. One-time products are not repeated each month.
 * A product the agency has never switched keeps whatever line is already on the billing config.
 */

import { ADDON_CATALOG, addonCatalogPriceCents, isAddonIncludedInPlan } from "./addon-catalog.js";
import type { AddonKey, TenantAddonState, TenantEntitlements } from "./addon-types.js";
import type { AgencyAddonConfig, AgencyBillingConfig } from "./invoice-types.js";

const MONTHLY_CATALOG_KEYS = new Set<string>(
  ADDON_CATALOG.filter((def) => def.billingType === "monthly").map((def) => def.key),
);

export function entitledMonthlyInvoiceAddons(
  entitlements: Pick<TenantEntitlements, "plan" | "addons"> | null | undefined,
  nowIso: string,
): AgencyAddonConfig[] {
  if (!entitlements?.addons) return [];
  const lines: AgencyAddonConfig[] = [];
  for (const def of ADDON_CATALOG) {
    if (def.billingType !== "monthly") continue;
    const state = entitlements.addons[def.key];
    if (!state?.enabled) continue;
    if (isAddonIncludedInPlan(def, entitlements.plan)) continue;
    const monthlyFeeCents = state.overridePriceCents ?? addonCatalogPriceCents(def);
    if (monthlyFeeCents <= 0) continue;
    lines.push({
      key: def.key,
      label: def.name,
      monthlyFeeCents,
      enabledAt: state.enabledAt ?? nowIso,
    });
  }
  return lines;
}

export function billingConfigWithEntitledAddons(
  config: AgencyBillingConfig,
  entitlements: Pick<TenantEntitlements, "plan" | "addons"> | null | undefined,
  nowIso: string,
): AgencyBillingConfig {
  if (!entitlements?.addons) return config;

  const entitledByKey = new Map(
    entitledMonthlyInvoiceAddons(entitlements, nowIso).map((addon) => [addon.key, addon]),
  );
  const existingByKey = new Map((config.addons ?? []).map((addon) => [addon.key, addon]));
  const handled = new Set<string>();
  const addons: AgencyAddonConfig[] = [];

  for (const key of MONTHLY_CATALOG_KEYS) {
    const state: TenantAddonState | undefined = entitlements.addons[key as AddonKey];
    const existing = existingByKey.get(key);
    if (state?.enabled) {
      handled.add(key);
      const entitled = entitledByKey.get(key);
      if (entitled) addons.push(entitled);
      continue;
    }
    if (state?.disabledAt) {
      handled.add(key);
      continue;
    }
    if (existing) {
      handled.add(key);
      addons.push(existing);
    }
  }

  for (const existing of config.addons ?? []) {
    if (!handled.has(existing.key)) addons.push(existing);
  }

  return { ...config, addons };
}
