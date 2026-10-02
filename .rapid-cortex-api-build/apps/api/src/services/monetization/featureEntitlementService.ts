import type { MonetizationFeatureKey, UserContext } from "rapid-cortex-shared";
import { resolveFeatureEntitlements, isRcsuperadmin } from "rapid-cortex-shared";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { MonetizationAddOnRepository } from "../../repositories/monetizationAddOnRepository.js";

const agencies = new AgencyRepository();
const addOnsRepo = new MonetizationAddOnRepository();

function parseOverrides(raw: string | undefined): Partial<Record<MonetizationFeatureKey, boolean>> | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as Partial<Record<MonetizationFeatureKey, boolean>>;
  } catch {
    return null;
  }
}

export class FeatureEntitlementService {
  /** Backend gate for monetized surfaces; RC Admin bypasses. */
  async userMayAccessFeature(user: UserContext, feature: MonetizationFeatureKey): Promise<boolean> {
    if (isRcsuperadmin(user)) return true;
    const tenant = await agencies.get(user.agencyId);
    if (!tenant) return false;

    const defs = await addOnsRepo.scanAll();
    const entitlementSet = resolveFeatureEntitlements({
      planId: tenant.monetizationPlanId ?? "essential",
      addOnIds: tenant.monetizationAddOnIds ?? [],
      monetizationAddOnDefs: defs,
      featureOverrides: parseOverrides(tenant.monetizationFeatureOverridesJson) ?? undefined,
    });
    const entitled = entitlementSet.has(feature);
    if (!entitled) return false;

    const blockedSubscription =
      tenant.subscriptionStatus &&
      ["past_due", "canceled", "unpaid"].includes(tenant.subscriptionStatus);

    const billingInactive = tenant.billingStatus && tenant.billingStatus !== "active";

    if (billingInactive || blockedSubscription) {
      const overrides = parseOverrides(tenant.monetizationFeatureOverridesJson);
      return !!(overrides && overrides[feature] === true);
    }

    return true;
  }
}
