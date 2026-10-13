import { describe, expect, it } from "vitest";
import { safeHttpUrl } from "./safe-http-url";

describe("safeHttpUrl", () => {
  it("allows https URLs", () => {
    expect(safeHttpUrl("https://metrocouncil.org/rfp")).toBe("https://metrocouncil.org/rfp");
  });

  it("rejects javascript and non-http schemes", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("ftp://example.com/a")).toBeNull();
  });

  it("rejects empty and invalid", () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
  });
});
