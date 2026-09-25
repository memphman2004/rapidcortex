import { describe, expect, it } from "vitest";
import { computeCommission } from "./commission-math";

describe("computeCommission", () => {
  it("returns $29,000 on $200K ACV", () => {
    const result = computeCommission(20_000_000);
    expect(result.commissionCents).toBe(2_900_000);
  });
});
