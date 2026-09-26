import { describe, expect, it } from "vitest";
import { computeInvoice, previewInvoice, parseBillingPeriod } from "./billing-engine.js";
import { DISCOUNT_BASIS_POINTS, OVERAGE_RATES, resolveTier } from "./pricing-table.js";
import type { AgencyBillingConfig, MonthlyUsageSnapshot } from "./invoice-types.js";

function baseConfig(overrides: Partial<AgencyBillingConfig> = {}): AgencyBillingConfig {
  return {
    agencyId: "test-agency",
    agencyName: "NexCort iQ Test Agency",
    planId: "professional",
    billingCycle: "monthly",
    contractTermYears: 1,
    contractStartDate: "2026-01-01",
    contractEndDate: "2026-12-31",
    contractedDispatcherSeats: 12,
    contractedAdminSeats: 5,
    addons: [],
    discounts: [],
    billingContactEmail: "billing@test-agency.gov",
    billingContactName: "Test Billing Contact",
    paymentMethod: "ach",
    taxExempt: true,
    goLiveDate: "2026-01-01",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function usage(
  agencyId: string,
  billingPeriod: string,
  overrides: Partial<MonthlyUsageSnapshot> = {},
): MonthlyUsageSnapshot {
  return {
    agencyId,
    billingPeriod,
    activeDispatcherSeats: 12,
    activeAdminSeats: 5,
    totalCallsProcessed: 8000,
    transcriptionMinutes: 0,
    translationRequests: 0,
    storageGb: 40,
    archiveStorageGb: 0,
    photosCount: 0,
    dataExportGb: 0,
    snapshotAt: "2026-09-30T22:00:00.000Z",
    source: "auto",
    ...overrides,
  };
}

describe("resolveTier", () => {
  it("maps professional 12 seats to T2", () => {
    const tier = resolveTier("professional", 12);
    expect(tier?.tierId).toBe("t2");
    expect(tier?.monthlyFeeCents).toBe(1_300_000);
  });

  it("returns null for enterprise", () => {
    expect(resolveTier("enterprise", 100)).toBeNull();
  });
});

describe("computeInvoice", () => {
  it("bills professional T2 base with no overages", () => {
    const invoice = computeInvoice({
      config: baseConfig(),
      usage: usage("test-agency", "2026-09"),
      period: { year: 2026, month: 9 },
      sequenceNumber: 1,
    });
    expect(invoice.invoiceId).toBe("INV-202609-TESTAGENC-0001");
    expect(invoice.tierLabel).toBe("Professional — T2");
    expect(invoice.subtotalCents).toBe(1_300_000);
    expect(invoice.discountCents).toBe(0);
    expect(invoice.totalCents).toBe(1_300_000);
    expect(invoice.dueDate).toBe("2026-10-30");
    expect(invoice.proRated).toBe(false);
    expect(invoice.pricingVersion).toBe("2026-09");
  });

  it("pro-rates the first month from go-live day", () => {
    const invoice = computeInvoice({
      config: baseConfig({
        planId: "essential",
        contractedDispatcherSeats: 3,
        contractedAdminSeats: 2,
        goLiveDate: "2026-09-16",
      }),
      usage: usage("test-agency", "2026-09", {
        activeDispatcherSeats: 3,
        activeAdminSeats: 2,
        totalCallsProcessed: 100,
      }),
      period: { year: 2026, month: 9 },
      sequenceNumber: 1,
    });
    expect(invoice.proRated).toBe(true);
    expect(invoice.proRationDays).toBe(15);
    // 15/30 * 280000 = 140000
    expect(invoice.totalCents).toBe(140_000);
    expect(invoice.lines[0]?.unitLabel).toBe("day");
  });

  it("charges dispatcher seat overage at the tier rate", () => {
    const invoice = computeInvoice({
      config: baseConfig({ contractedDispatcherSeats: 12 }),
      usage: usage("test-agency", "2026-09", { activeDispatcherSeats: 20 }),
      period: { year: 2026, month: 9 },
      sequenceNumber: 2,
    });
    const seat = invoice.lines.find((l) => l.category === "seat_overage" && l.description.includes("Dispatcher"));
    expect(seat?.quantity).toBe(2);
    expect(seat?.amountCents).toBe(2 * 12_500);
  });

  it("rounds fractional call overage cents", () => {
    const invoice = computeInvoice({
      config: baseConfig({
        planId: "essential",
        contractedDispatcherSeats: 3,
      }),
      usage: usage("test-agency", "2026-09", {
        activeDispatcherSeats: 3,
        totalCallsProcessed: 2010,
      }),
      period: { year: 2026, month: 9 },
      sequenceNumber: 3,
    });
    const calls = invoice.lines.find((l) => l.description.includes("Call volume"));
    expect(calls?.quantity).toBe(10);
    expect(calls?.amountCents).toBe(Math.round(10 * OVERAGE_RATES.callsPerCallCents));
  });

  it("applies 1-year commit on MRC and bundle only with 3+ add-ons", () => {
    const addons = [
      { key: "live-translation", label: "Live Translation", monthlyFeeCents: 200_000, enabledAt: "2026-01-01T00:00:00Z" },
      { key: "caller-video", label: "Caller Video Upload", monthlyFeeCents: 350_000, enabledAt: "2026-01-01T00:00:00Z" },
      { key: "qa-tools", label: "QA Review Tools", monthlyFeeCents: 250_000, enabledAt: "2026-01-01T00:00:00Z" },
    ];
    const invoice = computeInvoice({
      config: baseConfig({
        addons,
        discounts: [
          {
            type: "annualCommit1yr",
            basisPoints: DISCOUNT_BASIS_POINTS.annualCommit1yr,
            label: "Annual Commitment (1-year)",
            appliesTo: "mrc",
            approvedBy: "seed",
          },
          {
            type: "bundleAddon3Plus",
            basisPoints: DISCOUNT_BASIS_POINTS.bundleAddon3Plus,
            label: "Bundle Discount (3+ add-ons)",
            appliesTo: "addons",
            approvedBy: "seed",
          },
        ],
      }),
      usage: usage("test-agency", "2026-09"),
      period: { year: 2026, month: 9 },
      sequenceNumber: 4,
    });
    const addonTotal = 200_000 + 350_000 + 250_000;
    const mrc = 1_300_000 + addonTotal;
    const annual = Math.round((mrc * 1000) / 10_000);
    const bundle = Math.round((addonTotal * 1500) / 10_000);
    expect(invoice.discountCents).toBe(annual + bundle);
    expect(invoice.totalCents).toBe(mrc - annual - bundle);
  });

  it("skips bundle discount when fewer than 3 add-ons", () => {
    const invoice = computeInvoice({
      config: baseConfig({
        addons: [
          { key: "qa-tools", label: "QA Review Tools", monthlyFeeCents: 250_000, enabledAt: "2026-01-01T00:00:00Z" },
        ],
        discounts: [
          {
            type: "bundleAddon3Plus",
            basisPoints: 1500,
            label: "Bundle",
            appliesTo: "addons",
            approvedBy: "seed",
          },
        ],
      }),
      usage: usage("test-agency", "2026-09"),
      period: { year: 2026, month: 9 },
      sequenceNumber: 5,
    });
    expect(invoice.discountCents).toBe(0);
  });

  it("requires customMonthlyFeeCents for enterprise", () => {
    expect(() =>
      computeInvoice({
        config: baseConfig({ planId: "enterprise" }),
        usage: usage("test-agency", "2026-09"),
        period: { year: 2026, month: 9 },
        sequenceNumber: 1,
      }),
    ).toThrow(/customMonthlyFeeCents/);
  });

  it("uses enterprise custom fee when provided", () => {
    const invoice = computeInvoice({
      config: baseConfig({
        planId: "enterprise",
        contractedDispatcherSeats: 80,
        customMonthlyFeeCents: 7_500_000,
      }),
      usage: usage("test-agency", "2026-09", { activeDispatcherSeats: 80, totalCallsProcessed: 50 }),
      period: { year: 2026, month: 9 },
      sequenceNumber: 9,
    });
    expect(invoice.tierLabel).toBe("Enterprise — Custom");
    expect(invoice.totalCents).toBe(7_500_000);
  });
});

describe("previewInvoice", () => {
  it("warns when snapshotAt is empty", () => {
    const result = previewInvoice(
      baseConfig(),
      usage("test-agency", "2026-09", { snapshotAt: "" }),
      parseBillingPeriod("2026-09"),
    );
    expect(result.warnings.some((w) => w.includes("No usage snapshot"))).toBe(true);
    expect(result.invoice.totalCents).toBeGreaterThan(0);
  });
});
