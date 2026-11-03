import { describe, expect, it } from "vitest";
import {
  SALES_EMAIL_POLISH_MIN_BODY,
  salesEmailPolishMockFixture,
  salesEmailPolishRequestSchema,
  salesEmailPolishResultSchema,
} from "./email-polish-schemas.js";

describe("salesEmailPolishRequestSchema", () => {
  it("rejects short body", () => {
    expect(salesEmailPolishRequestSchema.safeParse({ body: "too short" }).success).toBe(false);
  });

  it("accepts body and defaults tone", () => {
    const ok = salesEmailPolishRequestSchema.safeParse({
      body: "x".repeat(SALES_EMAIL_POLISH_MIN_BODY),
      subject: "Hello",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.tone).toBe("professional");
  });
});

describe("salesEmailPolishMockFixture", () => {
  it("returns mock result matching schema", () => {
    const req = salesEmailPolishRequestSchema.parse({
      subject: "hi",
      body: "hello there, this is a sales email draft for testing.",
    });
    const out = salesEmailPolishMockFixture(req);
    expect(salesEmailPolishResultSchema.parse(out).mock).toBe(true);
    expect(out.body.length).toBeGreaterThan(0);
  });
});
