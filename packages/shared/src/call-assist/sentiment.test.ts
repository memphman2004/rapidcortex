import { describe, expect, it } from "vitest";
import { combineSentiment, mockSentimentFromText, sentimentFromLex } from "./sentiment.js";

describe("Call Assist sentiment", () => {
  it("maps Lex sentiment and prefers the more negative combined score", () => {
    const lex = sentimentFromLex({
      sentiment: "NEUTRAL",
      sentimentScore: { positive: 0.2, negative: 0.2, mixed: 0.1, neutral: 0.5 },
    });
    const mock = mockSentimentFromText("this is terrible I hate this");
    expect(mock.label).toBe("NEGATIVE");
    const combined = combineSentiment(lex, mock);
    expect(combined?.label).toBe("NEGATIVE");
  });
});
