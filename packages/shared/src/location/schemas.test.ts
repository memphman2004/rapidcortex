import { describe, expect, it } from "vitest";
import { alsGeocodeQuerySchema } from "./schemas";

describe("alsGeocodeQuerySchema", () => {
  it("accepts address", () => {
    const parsed = alsGeocodeQuerySchema.parse({ address: "17 Tullamore Trl, Tyrone, GA" });
    expect(parsed.address).toBe("17 Tullamore Trl, Tyrone, GA");
  });

  it("accepts legacy q as address", () => {
    const parsed = alsGeocodeQuerySchema.parse({ q: "17 Tullamore Trl, Tyrone, GA" });
    expect(parsed.address).toBe("17 Tullamore Trl, Tyrone, GA");
  });

  it("rejects an empty query", () => {
    expect(alsGeocodeQuerySchema.safeParse({}).success).toBe(false);
  });
});
