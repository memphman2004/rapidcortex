import { describe, expect, it } from "vitest";
import { hospitalPreAlertStatusSchema } from "rapid-cortex-shared";

describe("hospital pre-alert status machine", () => {
  it("allows draft and ready_to_send before send", () => {
    expect(hospitalPreAlertStatusSchema.safeParse("DRAFT").success).toBe(true);
    expect(hospitalPreAlertStatusSchema.safeParse("READY_TO_SEND").success).toBe(true);
  });

  it("includes terminal states", () => {
    for (const s of ["SENT", "ACKNOWLEDGED", "CANCELLED", "FAILED"] as const) {
      expect(hospitalPreAlertStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});
