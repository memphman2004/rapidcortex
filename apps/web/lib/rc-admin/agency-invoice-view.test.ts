import { describe, expect, it } from "vitest";
import {
  buildAgencyInvoicePrefillLines,
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
    expect(lines).toHaveLength(3);
    expect(lines[0]?.description).toContain("RC CORE");
    expect(lines[0]?.unitPrice).toBe(1999);
    expect(lines[1]?.unitPrice).toBe(500);
    expect(lines[2]?.description).toContain("one-time");
  });

  it("skips disabled and zero-price add-ons", () => {
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
