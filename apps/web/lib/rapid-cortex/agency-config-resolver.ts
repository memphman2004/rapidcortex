import type { UserContext } from "rapid-cortex-shared";
import { deriveAgencyConfigFromUser } from "@/lib/rapid-cortex/agency-config";
import type { AgencyFeatureConfig } from "@/lib/rapid-cortex/entitlements";

/**
 * In-memory last-write overlay for /api/agency/config PATCH in dev and pilot.
 * Production should replace this with a backend agency profile service.
 */
const agencyConfigById = new Map<string, AgencyFeatureConfig>();

export function mergeAgencyConfig(
  base: AgencyFeatureConfig,
  patch: Partial<AgencyFeatureConfig>,
): AgencyFeatureConfig {
  return {
    ...base,
    ...patch,
    enabledAddOns: patch.enabledAddOns ?? base.enabledAddOns,
    limitedFeatureOverrides: patch.limitedFeatureOverrides ?? base.limitedFeatureOverrides,
    disabledFeatures: patch.disabledFeatures ?? base.disabledFeatures,
  };
}

export function resolveAgencyConfigForUser(user: UserContext | null): AgencyFeatureConfig {
  const base = deriveAgencyConfigFromUser(user);
  if (!user) return base;
  const saved = agencyConfigById.get(user.agencyId);
  if (!saved) return base;
  return { ...saved, agencyId: user.agencyId };
}

export function saveAgencyConfigForUser(
  user: UserContext,
  patch: Partial<AgencyFeatureConfig>,
): AgencyFeatureConfig {
  const last = agencyConfigById.get(user.agencyId) ?? deriveAgencyConfigFromUser(user);
  const next = mergeAgencyConfig(last, { ...patch, agencyId: user.agencyId });
  agencyConfigById.set(user.agencyId, next);
  return next;
}
