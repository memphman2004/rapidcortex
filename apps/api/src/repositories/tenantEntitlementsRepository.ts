import {
  ADDON_KEYS,
  type AddonKey,
  type AgencyBillingProfile,
  type TenantAddonState,
  type TenantEntitlements,
} from "rapid-cortex-shared";
import { BillingProfileRepository } from "./billingProfileRepository.js";
import { AgencyRepository } from "./agencyRepository.js";

const billingProfiles = new BillingProfileRepository();
const agencies = new AgencyRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function seedAddonStates(): Record<AddonKey, TenantAddonState> {
  const addons = {} as Record<AddonKey, TenantAddonState>;
  for (const key of ADDON_KEYS) {
    addons[key] = { key, enabled: false };
  }
  return addons;
}

function mergeAddonStates(existing?: Record<AddonKey, TenantAddonState>): Record<AddonKey, TenantAddonState> {
  const seeded = seedAddonStates();
  if (!existing) return seeded;
  return { ...seeded, ...existing };
}

function defaultProfileShell(agencyId: string, plan: string): AgencyBillingProfile {
  const t = nowIso();
  return {
    agencyId,
    schemaVersion: 1,
    billingAccount: {
      billingAccountId: `ba_${agencyId}`,
      agencyId,
      status: "current",
      preferredPaymentRail: "ach",
      createdAt: t,
      updatedAt: t,
    },
    contacts: {
      billingContactName: "Billing",
      billingContactEmail: "billing@example.com",
    },
    paymentMode: "invoice_only",
    selfServeCheckoutEnabled: false,
    assignedPlanId: plan === "essential" ? "essential" : undefined,
    invoices: [],
    paymentMethods: [],
    delinquency: { tier: "none", asOf: t },
    createdAt: t,
    updatedAt: t,
  };
}

export class TenantEntitlementsRepository {
  async getOrSeed(tenantId: string, actorEmail: string): Promise<TenantEntitlements> {
    const agency = await agencies.get(tenantId);
    const plan = agency?.monetizationPlanId ?? agency?.planId ?? "essential";
    let profile = await billingProfiles.get(tenantId);
    if (!profile?.tenantEntitlements) {
      const entitlements: TenantEntitlements = {
        tenantId,
        plan,
        addons: seedAddonStates(),
        lastModifiedAt: nowIso(),
        lastModifiedBy: actorEmail,
        schemaVersion: 1,
      };
      const base = profile ?? defaultProfileShell(tenantId, plan);
      await billingProfiles.put({
        ...base,
        tenantEntitlements: entitlements,
        updatedAt: nowIso(),
      });
      return entitlements;
    }

    const mergedAddons = mergeAddonStates(profile.tenantEntitlements.addons);
    const entitlements: TenantEntitlements = {
      ...profile.tenantEntitlements,
      plan,
      addons: mergedAddons,
    };
    const needsPersist = ADDON_KEYS.some((key) => profile.tenantEntitlements!.addons[key] === undefined);
    if (needsPersist) {
      await billingProfiles.put({
        ...profile,
        tenantEntitlements: entitlements,
        updatedAt: nowIso(),
      });
    }
    return entitlements;
  }

  async putConditional(
    tenantId: string,
    entitlements: TenantEntitlements,
    expectedLastModifiedAt: string,
  ): Promise<void> {
    const profile = (await billingProfiles.get(tenantId)) ?? defaultProfileShell(tenantId, entitlements.plan);
    if (
      profile.tenantEntitlements?.lastModifiedAt &&
      profile.tenantEntitlements.lastModifiedAt !== expectedLastModifiedAt
    ) {
      const err = new Error("CONCURRENT_MODIFICATION");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }
    await billingProfiles.put({
      ...profile,
      tenantEntitlements: entitlements,
      updatedAt: nowIso(),
    });
  }
}
