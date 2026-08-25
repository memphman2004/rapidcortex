import { describe, expect, it } from "vitest";
import { sourceUrlTitleHash } from "../ingest-utils.js";

describe("sourceUrlTitleHash", () => {
  it("is stable SHA-256 hex of sourceUrl|title", () => {
    const a = sourceUrlTitleHash("https://example.com/opp", "NG911 RFP");
    const b = sourceUrlTitleHash("https://example.com/opp", "NG911 RFP");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(sourceUrlTitleHash("https://example.com/opp", "Other")).not.toBe(a);
  });
});
