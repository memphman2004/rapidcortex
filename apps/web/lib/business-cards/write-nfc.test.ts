import { describe, expect, it } from "vitest";
import { nfcUrlRecord } from "./write-nfc";

describe("nfcUrlRecord", () => {
  it("keeps an https business-card address", () => {
    expect(nfcUrlRecord("https://www.nexcortiq.us/c/card-1")).toEqual({
      recordType: "url",
      data: "https://www.nexcortiq.us/c/card-1",
    });
  });

  it("rejects addresses the phone would not open as a website", () => {
    expect(() => nfcUrlRecord("http://www.nexcortiq.us/c/card-1")).toThrow(/https/);
    expect(() => nfcUrlRecord("not a url")).toThrow(/valid URL/);
  });
});
