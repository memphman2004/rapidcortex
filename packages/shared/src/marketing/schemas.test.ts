import { describe, expect, it } from "vitest";
import {
  buildMarketingLeadRequestBody,
  isMarketingBusinessEmail,
  resolveMarketingLeadSource,
  marketingUnsubscribeBodySchema,
} from "./schemas.js";

describe("marketing lead schemas", () => {
  it("accepts agency business email", () => {
    expect(isMarketingBusinessEmail("jane@youragency.gov")).toBe(true);
    const built = buildMarketingLeadRequestBody({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@youragency.gov",
      state: "Louisiana",
    });
    expect(built.ok).toBe(true);
  });

  it("rejects gmail with field error for the popup", () => {
    expect(isMarketingBusinessEmail("a@gmail.com")).toBe(false);
    const built = buildMarketingLeadRequestBody({
      firstName: "Jane",
      lastName: "Smith",
      email: "a@gmail.com",
      state: "LA",
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.fieldErrors.email).toMatch(/business email/i);
  });

  it("normalizes email case and trims names", () => {
    const built = buildMarketingLeadRequestBody(
      {
        firstName: "  Pat ",
        lastName: " Lee ",
        email: "Pat.Lee@Agency.GOV",
        state: " NY ",
      },
      {
        referrer: "https://x.com/foo",
        landingPage: "/blog/?utm_source=x",
        capturedAt: "2026-07-20T00:00:00.000Z",
      },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.email).toBe("pat.lee@agency.gov");
    expect(built.body.firstName).toBe("Pat");
    expect(resolveMarketingLeadSource(built.body.referrer)).toBe("twitter");
  });

  it("validates unsubscribe UUID v4", () => {
    expect(
      marketingUnsubscribeBodySchema.safeParse({
        token: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      }).success,
    ).toBe(true);
    expect(marketingUnsubscribeBodySchema.safeParse({ token: "not-a-uuid" }).success).toBe(false);
  });
});
