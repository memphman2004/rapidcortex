import { describe, expect, it } from "vitest";
import { createQRNFCSchema } from "./schemas.js";

describe("createQRNFCSchema", () => {
  it("accepts 10-digit US call numbers and normalizes to E.164", () => {
    const parsed = createQRNFCSchema.parse({
      name: "downtown",
      vertical: "911",
      reportType: "anonymous",
      callNumber: "8085428061",
    });
    expect(parsed.callNumber).toBe("+18085428061");
  });
});
