import { describe, expect, it } from "vitest";
import { computeInvoice } from "./billing-engine.js";
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailSubject,
  buildInvoiceEmailText,
} from "./invoice-email-builder.js";
import type { AgencyBillingConfig, MonthlyUsageSnapshot } from "./invoice-types.js";

const config: AgencyBillingConfig = {
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
};

const usage: MonthlyUsageSnapshot = {
  agencyId: "test-agency",
  billingPeriod: "2026-09",
  activeDispatcherSeats: 12,
  activeAdminSeats: 5,
  totalCallsProcessed: 100,
  transcriptionMinutes: 0,
  translationRequests: 0,
  storageGb: 10,
  archiveStorageGb: 0,
  photosCount: 0,
  dataExportGb: 0,
  snapshotAt: "2026-09-30T22:00:00.000Z",
  source: "auto",
};

describe("invoice email builder", () => {
  const invoice = computeInvoice({
    config,
    usage,
    period: { year: 2026, month: 9 },
    sequenceNumber: 1,
  });

  it("includes invoice id, NET 30, and public MSA payment identifiers", () => {
    const html = buildInvoiceEmailHtml(invoice);
    const text = buildInvoiceEmailText(invoice);
    const subject = buildInvoiceEmailSubject(invoice);
    expect(subject).toContain(invoice.invoiceId);
    expect(html).toContain("NET 30");
    expect(html).toContain("256074974");
    expect(html).toContain("NFCUUS33");
    expect(html).toContain("Apps on Demand LLC");
    expect(html).toContain("provided separately");
    expect(text).toContain("1.5%/month");
    expect(html).not.toMatch(/Account number:\s*\d{6,}/);
  });
});
