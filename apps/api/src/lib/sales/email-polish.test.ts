import { afterEach, describe, expect, it } from "vitest";
import { polishSalesEmail } from "./email-polish.js";

describe("polishSalesEmail", () => {
  afterEach(() => {
    delete process.env.BEDROCK_MOCK;
    delete process.env.SALES_EMAIL_POLISH_BEDROCK_MODEL_ID;
  });

  it("returns fixture when BEDROCK_MOCK=1", async () => {
    process.env.BEDROCK_MOCK = "1";
    const result = await polishSalesEmail({
      subject: "hello",
      body: "this is a sample sales email that needs polish for grammar.",
      tone: "professional",
    });
    expect(result.mock).toBe(true);
    expect(result.body.length).toBeGreaterThan(10);
  });
});
