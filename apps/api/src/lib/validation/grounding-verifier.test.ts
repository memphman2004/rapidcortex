import { describe, expect, it } from "vitest";
import {
  applyFieldGrounding,
  areKeyTermsGrounded,
  isQuoteGroundedInTranscript,
} from "./grounding-verifier.js";

describe("grounding-verifier", () => {
  const transcript =
    "dispatcher: 911 what is your emergency\n" +
    "caller: someone broke into my house at eight four seven elm street they have a knife";

  it("accepts grounded quote and value", () => {
    const result = applyFieldGrounding({
      field: "location",
      value: "847 Elm Street",
      sourceQuote: "eight four seven elm street",
      transcript,
    });
    expect(result.value).toBe("847 Elm Street");
    expect(result.flag).toBeUndefined();
  });

  it("rejects value without source quote", () => {
    const result = applyFieldGrounding({
      field: "weapons",
      value: "rifle",
      sourceQuote: null,
      transcript,
    });
    expect(result.value).toBeNull();
    expect(result.flag?.gate).toBe("source_citation");
  });

  it("rejects fabricated address not in transcript", () => {
    const result = applyFieldGrounding({
      field: "location",
      value: "123 Main Street",
      sourceQuote: "they have a knife",
      transcript,
    });
    expect(result.value).toBeNull();
    expect(result.flag?.gate).toBe("lexical_terms");
  });

  it("matches spoken numbers in quote", () => {
    expect(isQuoteGroundedInTranscript("eight four seven elm street", transcript)).toBe(true);
    expect(areKeyTermsGrounded("847 elm street", transcript)).toBe(true);
  });
});
