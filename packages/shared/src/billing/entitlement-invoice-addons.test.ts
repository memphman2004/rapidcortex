import { describe, expect, it } from "vitest";
import type { AddonKey, TenantAddonState, TenantEntitlements } from "./addon-types.js";
import {
  billingConfigWithEntitledAddons,
  entitledMonthlyInvoiceAddons,
} from "./entitlement-invoice-addons.js";
import type { AgencyBillingConfig } from "./invoice-types.js";

const NOW = "2026-10-24T00:00:00.000Z";

function state(partial: Partial<TenantAddonState> & { key: AddonKey }): TenantAddonState {
  return { enabled: false, ...partial };
}

function entitlements(
  plan: string,
  addons: Partial<Record<AddonKey, TenantAddonState>>,
): Pick<TenantEntitlements, "plan" | "addons"> {
  return {
    plan,
    addons: addons as TenantEntitlements["addons"],
  };
}

function config(addons: AgencyBillingConfig["addons"]): AgencyBillingConfig {
  return {
    agencyId: "agency-1",
    agencyName: "Test",
    planId: "professional",
    billingCycle: "monthly",
    contractTermYears: 1,
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    contractedDispatcherSeats: 8,
    contractedAdminSeats: 2,
    addons,
    discounts: [],
    billingContactEmail: "billing@example.gov",
    billingContactName: "Billing",
    paymentMethod: "ach",
    taxExempt: true,
    goLiveDate: "2026-01-01",
    status: "active",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("entitledMonthlyInvoiceAddons", () => {
  it("bills an enabled monthly product that is not in the plan", () => {
    const lines = entitledMonthlyInvoiceAddons(
      entitlements("professional", {
        "cad.connector": state({
          key: "cad.connector",
          enabled: true,
          enabledAt: NOW,
        }),
      }),
      NOW,
    );
    expect(lines).toEqual([
      {
        key: "cad.connector",
        label: "Multi-CAD Connector",
        monthlyFeeCents: 350_000,
        enabledAt: NOW,
      },
    ]);
  });

  it("uses a custom price and skips plan-included and one-time products", () => {
    const custom = entitledMonthlyInvoiceAddons(
      entitlements("professional", {
        "cad.connector": state({
          key: "cad.connector",
          enabled: true,
          overridePriceCents: 12_500,
        }),
        "cad.discovery": state({ key: "cad.discovery", enabled: true }),
      }),
      NOW,
    );
    expect(custom).toEqual([
      {
        key: "cad.connector",
        label: "Multi-CAD Connector",
        monthlyFeeCents: 12_500,
        enabledAt: NOW,
      },
    ]);

    const included = entitledMonthlyInvoiceAddons(
      entitlements("command", {
        "cad.connector": state({ key: "cad.connector", enabled: true, overridePriceCents: 12_500 }),
      }),
      NOW,
    );
    expect(included).toEqual([]);
  });
});

describe("billingConfigWithEntitledAddons", () => {
  it("replaces a switched-on product and drops one that was turned off", () => {
    const next = billingConfigWithEntitledAddons(
      config([
        {
          key: "cad.connector",
          label: "Old label",
          monthlyFeeCents: 100,
          enabledAt: "2026-01-01T00:00:00.000Z",
        },
        {
          key: "custom.retainer",
          label: "Retainer",
          monthlyFeeCents: 5000,
          enabledAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
      entitlements("professional", {
        "cad.connector": state({
          key: "cad.connector",
          enabled: false,
          disabledAt: NOW,
        }),
      }),
      NOW,
    );
    expect(next.addons.map((addon) => addon.key)).toEqual(["custom.retainer"]);
  });

  it("keeps a billing-config line when the product switch has never been used", () => {
    const next = billingConfigWithEntitledAddons(
      config([
        {
          key: "cad.connector",
          label: "Multi-CAD Connector",
          monthlyFeeCents: 1000,
          enabledAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
      entitlements("professional", {
        "cad.connector": state({ key: "cad.connector", enabled: false }),
      }),
      NOW,
    );
    expect(next.addons).toHaveLength(1);
    expect(next.addons[0]?.monthlyFeeCents).toBe(1000);
  });
});
