import { describe, expect, it } from "vitest";
import { patchPsapProspectBodySchema } from "./schemas.js";

describe("patchPsapProspectBodySchema monthlyEmailOptIn", () => {
  it("accepts monthlyEmailOptIn with contact fields", () => {
    const parsed = patchPsapProspectBodySchema.parse({
      primaryContactEmail: "chief@example.gov",
      primaryContactName: "Alex",
      monthlyEmailOptIn: true,
    });
    expect(parsed.monthlyEmailOptIn).toBe(true);
  });

  it("accepts opt-out", () => {
    const parsed = patchPsapProspectBodySchema.parse({ monthlyEmailOptIn: false });
    expect(parsed.monthlyEmailOptIn).toBe(false);
  });
});
