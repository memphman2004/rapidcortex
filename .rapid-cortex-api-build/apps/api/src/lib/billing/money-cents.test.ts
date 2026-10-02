import { describe, expect, it } from "vitest";
import { computeTotalsCents, dollarsToCents, resolveAmountDollars } from "./money-cents.js";
import { normalizePaymentInstructions, validatePaymentInstructionsForSend } from "./payment-instructions.js";
import { nextMonthBillingPeriod } from "../../services/billingScheduleProcessor.js";

describe("money-cents", () => {
  it("converts dollars to cents without float drift", () => {
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it("computes invoice totals in cents and mirrors dollars", () => {
    const totals = computeTotalsCents({
      lineItems: [
        { quantity: 2, unitPriceDollars: 100 },
        { quantity: 1, unitPriceDollars: 49.5 },
      ],
      discountDollars: 10,
      taxDollars: 5,
    });
    expect(totals.subtotalCents).toBe(24950);
    expect(totals.discountCents).toBe(1000);
    expect(totals.taxCents).toBe(500);
    expect(totals.totalCents).toBe(24450);
    expect(totals.total).toBe(244.5);
  });

  it("prefers cents fields when resolving display dollars", () => {
    expect(resolveAmountDollars({ totalCents: 12345, total: 1 }, "total")).toBe(123.45);
    expect(resolveAmountDollars({ total: 50 }, "total")).toBe(50);
  });
});

describe("payment-instructions", () => {
  it("normalizes camelCase and UPPER_SNAKE keys", () => {
    const a = normalizePaymentInstructions({
      achRoutingNumber: "061000052",
      achAccountNumber: "123456789",
      bankName: "Test Bank",
      checkMailingAddress: "1 Main St",
    });
    expect(a.achRoutingNumber).toBe("061000052");
    const b = normalizePaymentInstructions({
      ACH_ROUTING_NUMBER: "061000052",
      ACH_ACCOUNT_NUMBER: "987654321",
      BANK_NAME: "Test Bank",
      CHECK_MAIL_TO: "1 Main St",
      WIRE_SWIFT_CODE: "TESTUS33",
      WIRE_ACCOUNT_NUMBER: "999",
    });
    expect(b.wireInstructions).toContain("TESTUS33");
  });

  it("rejects placeholders before send", () => {
    expect(() =>
      validatePaymentInstructionsForSend({
        achRoutingNumber: "REPLACE_ME",
        achAccountNumber: "123",
        bankName: "Bank",
        checkMailingAddress: "Addr",
      }),
    ).toThrow(/placeholder|missing/i);
  });
});

describe("nextMonthBillingPeriod", () => {
  it("returns next month start/end for 15-day advance schedule", () => {
    const period = nextMonthBillingPeriod(new Date(Date.UTC(2026, 6, 15))); // Jul 15
    expect(period.periodStart).toBe("2026-08-01");
    expect(period.periodEnd).toBe("2026-08-31");
    expect(period.dueDate).toBe("2026-08-31");
  });
});
