import { afterEach, describe, expect, it } from "vitest";
import { analyzeSalesCallTranscript } from "./call-coach-analyze.js";

describe("analyzeSalesCallTranscript", () => {
  afterEach(() => {
    delete process.env.BEDROCK_MOCK;
    delete process.env.SALES_CALL_COACH_BEDROCK_MODEL_ID;
  });

  it("returns fixture when BEDROCK_MOCK=1", async () => {
    process.env.BEDROCK_MOCK = "1";
    const result = await analyzeSalesCallTranscript({
      transcript: "x".repeat(60),
      vertical: "general",
    });
    expect(result.mock).toBe(true);
    expect(result.categories).toHaveLength(6);
  });
});
