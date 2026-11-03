import { describe, expect, it } from "vitest";
import {
  canAccessSalesTools,
  SALES_CALL_COACH_MIN_TRANSCRIPT,
  salesCallCoachAnalyzeRequestSchema,
  salesCallCoachMockFixture,
  salesCallCoachResultSchema,
} from "./call-coach-schemas.js";

describe("canAccessSalesTools", () => {
  it("allows sales and RC admin seats", () => {
    expect(canAccessSalesTools("salescontractor")).toBe(true);
    expect(canAccessSalesTools("rcadmin")).toBe(true);
    expect(canAccessSalesTools("rcsuperadmin")).toBe(true);
  });

  it("denies dispatcher", () => {
    expect(canAccessSalesTools("dispatcher")).toBe(false);
  });
});

describe("salesCallCoachAnalyzeRequestSchema", () => {
  it("rejects short transcripts", () => {
    const bad = salesCallCoachAnalyzeRequestSchema.safeParse({ transcript: "too short" });
    expect(bad.success).toBe(false);
  });

  it("accepts valid transcript and defaults vertical", () => {
    const ok = salesCallCoachAnalyzeRequestSchema.safeParse({
      transcript: "x".repeat(SALES_CALL_COACH_MIN_TRANSCRIPT),
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.vertical).toBe("general");
  });
});

describe("salesCallCoachResultSchema / mock fixture", () => {
  it("parses the mock fixture with six categories", () => {
    const fixture = salesCallCoachMockFixture();
    const parsed = salesCallCoachResultSchema.parse(fixture);
    expect(parsed.categories).toHaveLength(6);
    expect(parsed.overallScore).toBeGreaterThanOrEqual(0);
    expect(parsed.mock).toBe(true);
  });
});
