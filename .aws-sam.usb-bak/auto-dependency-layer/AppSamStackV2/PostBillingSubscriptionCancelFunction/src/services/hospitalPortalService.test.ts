import { describe, expect, it } from "vitest";
import { manualCapacityUpdateBodySchema } from "rapid-cortex-shared";

describe("manualCapacityUpdateBodySchema", () => {
  it("rejects available beds greater than total", () => {
    const result = manualCapacityUpdateBodySchema.safeParse({
      erBeds: { available: 10, total: 5 },
      icuBeds: { available: 2, total: 5 },
      waitTimeMinutes: 20,
      isOnDiversion: false,
      staffing: { erPhysicians: 2, erNurses: 4, adequateStaffing: true },
    });
    expect(result.success).toBe(false);
  });

  it("requires diversion reason when on diversion", () => {
    const result = manualCapacityUpdateBodySchema.safeParse({
      erBeds: { available: 0, total: 20 },
      icuBeds: { available: 1, total: 10 },
      waitTimeMinutes: 90,
      isOnDiversion: true,
      diversionType: "FULL",
      staffing: { erPhysicians: 1, erNurses: 2, adequateStaffing: false },
    });
    expect(result.success).toBe(false);
  });
});
