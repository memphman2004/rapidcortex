import { describe, expect, it } from "vitest";
import type { TenantAddonState, TenantEntitlements } from "rapid-cortex-shared";
import {
  buildAgencyInvoicePrefillLines,
  monthlyFeatureAddOnsToPrefill,
  resolveAgencyPlanMonthlyRate,
} from "./agency-invoice-view";

describe("resolveAgencyPlanMonthlyRate", () => {
  it("prefers currentMonthlyRate when set", () => {
    expect(resolveAgencyPlanMonthlyRate({ plan: "RC CORE", currentMonthlyRate: 2500 })).toBe(2500);
  });

  it("maps RC CORE to essential catalog price", () => {
    expect(resolveAgencyPlanMonthlyRate({ plan: "RC CORE", currentMonthlyRate: 0 })).toBe(1999);
  });
});

function entitlementsFixture(
  plan: string,
  addons: Partial<Record<string, TenantAddonState>>,
): Pick<TenantEntitlements, "plan" | "addons"> {
  return {
    plan,
    addons: addons as TenantEntitlements["addons"],
  };
}

describe("monthlyFeatureAddOnsToPrefill", () => {
  it("includes enabled monthly add-ons and uses USD override", () => {
    const rows = monthlyFeatureAddOnsToPrefill(
      entitlementsFixture("essential", {
        "ai.model_redundancy.tertiary": {
          key: "ai.model_redundancy.tertiary",
          enabled: true,
          overridePriceCents: 200_000,
        },
      }),
    );
    const tertiary = rows.find((row) => row.id === "ai.model_redundancy.tertiary");
    expect(tertiary).toEqual(
      expect.objectContaining({
        id: "ai.model_redundancy.tertiary",
        name: "Tertiary AI Model Fallback",
        unitPrice: 2000,
        billingCycle: "monthly",
        status: "enabled",
      }),
    );
  });

  it("includes plan-included monthly add-ons so they can be removed from a draft", () => {
    const rows = monthlyFeatureAddOnsToPrefill(entitlementsFixture("command", {}));
    const qa = rows.find((row) => row.id === "ai.qa_scoring");
    expect(qa).toEqual(
      expect.objectContaining({
        id: "ai.qa_scoring",
        includedInPlan: true,
        billingCycle: "monthly",
        status: "enabled",
      }),
    );
    expect(qa?.unitPrice).toBeGreaterThan(0);
  });

  it("skips opted-out plan-included, one-time, and disabled paid add-ons", () => {
    const rows = monthlyFeatureAddOnsToPrefill(
      entitlementsFixture("command", {
        "ai.qa_scoring": {
          key: "ai.qa_scoring",
          enabled: false,
          disabledAt: "2026-09-17T00:00:00.000Z",
        },
        "cad.discovery": {
          key: "cad.discovery",
          enabled: true,
        },
        "ai.model_redundancy.tertiary": {
          key: "ai.model_redundancy.tertiary",
          enabled: false,
        },
      }),
    );
    expect(rows.find((row) => row.id === "ai.qa_scoring")).toBeUndefined();
    expect(rows.find((row) => row.id === "cad.discovery")).toBeUndefined();
    expect(rows.find((row) => row.id === "ai.model_redundancy.tertiary")).toBeUndefined();
  });
});

describe("buildAgencyInvoicePrefillLines", () => {
  it("includes plan and enabled monthly add-ons", () => {
    const lines = buildAgencyInvoicePrefillLines(
      { plan: "RC CORE", currentMonthlyRate: 1999 },
      [
        {
          id: "translation.live.tier1",
          name: "Live Translation Tier 1",
          unitPrice: 500,
          billingCycle: "monthly",
          status: "enabled",
        },
        {
          id: "cad.discovery",
          name: "CAD Discovery",
          unitPrice: 5500,
          billingCycle: "one_time",
          status: "enabled",
        },
      ],
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]?.description).toContain("RC CORE");
    expect(lines[0]?.unitPrice).toBe(1999);
    expect(lines[1]?.description).toContain("monthly add-on");
    expect(lines[1]?.unitPrice).toBe(500);
  });

  it("labels plan-included lines so they can be taken off the draft", () => {
    const lines = buildAgencyInvoicePrefillLines(
      { plan: "Command", currentMonthlyRate: 4999 },
      [
        {
          id: "ai.qa_scoring",
          name: "AI QA Scoring Model",
          unitPrice: 750,
          billingCycle: "monthly",
          status: "enabled",
          includedInPlan: true,
          planLabel: "command",
        },
      ],
    );
    expect(lines).toHaveLength(2);
    expect(lines[1]?.description).toContain("included in command");
    expect(lines[1]?.unitPrice).toBe(750);
  });

  it("skips disabled, one-time, and zero-price add-ons", () => {
    const lines = buildAgencyInvoicePrefillLines(
      { plan: "Command", currentMonthlyRate: 0 },
      [
        {
          id: "x",
          name: "Off",
          unitPrice: 100,
          billingCycle: "monthly",
          status: "disabled",
        },
        {
          id: "y",
          name: "Free",
          unitPrice: 0,
          billingCycle: "monthly",
          status: "enabled",
        },
      ],
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.unitPrice).toBe(4999);
  });
});
