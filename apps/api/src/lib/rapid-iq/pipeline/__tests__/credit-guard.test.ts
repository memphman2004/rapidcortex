import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  BILLING_DAY,
  CREDIT_LIMITS,
  cycleEndForStart,
  cycleStartForDate,
  evaluateCanSpend,
  type CreditRecord,
} from "../credit-guard.js";
import { inferGovDomain } from "../enrich-hunter.js";

describe("cycleStartForDate / cycleEndForStart", () => {
  it("uses the 11th when date is on or after billing day", () => {
    expect(cycleStartForDate(new Date(2026, 7, 11))).toBe("2026-08-11");
    expect(cycleStartForDate(new Date(2026, 7, 12))).toBe("2026-08-11");
    expect(cycleStartForDate(new Date(2026, 7, 31))).toBe("2026-08-11");
  });

  it("uses previous month when date is before billing day", () => {
    expect(cycleStartForDate(new Date(2026, 7, 10))).toBe("2026-07-11");
    expect(cycleStartForDate(new Date(2026, 7, 1))).toBe("2026-07-11");
    expect(cycleStartForDate(new Date(2026, 0, 5))).toBe("2025-12-11");
  });

  it("ends the day before the next billing day", () => {
    expect(cycleEndForStart("2026-08-11")).toBe("2026-09-10");
    expect(cycleEndForStart("2026-01-11")).toBe("2026-02-10");
    expect(cycleEndForStart("2025-12-11")).toBe("2026-01-10");
  });

  it("billing day constant is 11", () => {
    expect(BILLING_DAY).toBe(11);
  });
});

describe("evaluateCanSpend", () => {
  const base: CreditRecord = {
    used: 2498,
    limit: CREDIT_LIMITS.apollo,
    cycleStart: "2026-08-11",
    cycleEnd: "2026-09-10",
    updatedAt: "2026-08-11T00:00:00.000Z",
  };

  it("allows spend within remaining budget", () => {
    const r = evaluateCanSpend(base, 2);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("rejects when amount exceeds remaining", () => {
    const r = evaluateCanSpend(base, 3);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(2);
    expect(r.reason).toMatch(/Credit limit reached/);
  });

  it("rejects when fully exhausted", () => {
    const exhausted: CreditRecord = { ...base, used: 2500 };
    const r = evaluateCanSpend(exhausted, 1);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("enforces Hunter 2000 and Apollo 2500 caps", () => {
    const hunter: CreditRecord = {
      ...base,
      used: 2000,
      limit: CREDIT_LIMITS.hunter,
    };
    expect(evaluateCanSpend(hunter, 1).allowed).toBe(false);
    expect(CREDIT_LIMITS.hunter).toBe(2000);
    expect(CREDIT_LIMITS.apollo).toBe(2500);
  });
});

describe("inferGovDomain", () => {
  it("builds jeffersoncounty.id.gov-style candidates", () => {
    const domains = inferGovDomain("Jefferson County 911", "Jefferson County", "ID");
    expect(domains.some((d) => d.includes("jefferson") && d.includes("id"))).toBe(true);
    expect(domains[0]).toMatch(/\.gov$|\.us$/);
  });
});
