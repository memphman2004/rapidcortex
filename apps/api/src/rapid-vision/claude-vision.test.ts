import { describe, expect, it } from "vitest";
import { parseClaudeVisionResponse, detectTranscriptCorrelation } from "./claude-vision.js";

describe("Rapid Vision™ Claude parse", () => {
  it("splits narrative from CATEGORY/CONFIDENCE lines", () => {
    const parsed = parseClaudeVisionResponse(
      "Person in a gray hoodie jogging north.\nCATEGORY: PERSON\nCONFIDENCE: HIGH\nCORRELATION_NOTE: Matches caller",
    );
    expect(parsed.narrative).toContain("gray hoodie");
    expect(parsed.category).toBe("PERSON");
    expect(parsed.confidence).toBe("HIGH");
    expect(parsed.correlationNote).toBe("Matches caller");
  });

  it("detects transcript overlap", () => {
    expect(
      detectTranscriptCorrelation(
        "gray hoodie jogging northbound on oak street",
        "subject wearing gray hoodie fled north on oak",
      ),
    ).toBe(true);
    expect(detectTranscriptCorrelation("empty street", "caller hung up")).toBe(false);
  });
});
