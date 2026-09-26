import { describe, expect, it } from "vitest";
import { createCodePayloadSchema } from "./schemas.js";

describe("createCodePayloadSchema", () => {
  it("accepts transit location codes", () => {
    const parsed = createCodePayloadSchema.parse({
      agencyId: "test-transit-hvt",
      name: "Lennox Station",
      zone: "Bay B",
      reportType: "both",
      vertical: "transit",
      smsNumber: "4088485000",
    });
    expect(parsed.vertical).toBe("transit");
    expect(parsed.zone).toBe("Bay B");
  });

  it("still accepts venue and campus", () => {
    expect(createCodePayloadSchema.parse({
      agencyId: "a",
      name: "Gate F",
      zone: "Section 123",
      reportType: "both",
      vertical: "venue",
    }).vertical).toBe("venue");
    expect(createCodePayloadSchema.parse({
      agencyId: "a",
      name: "Quad",
      zone: "Main",
      reportType: "anonymous",
      vertical: "campus",
    }).vertical).toBe("campus");
  });

  it("rejects unknown verticals", () => {
    const result = createCodePayloadSchema.safeParse({
      agencyId: "a",
      name: "X",
      zone: "Y",
      reportType: "both",
      vertical: "911",
    });
    expect(result.success).toBe(false);
  });
});
