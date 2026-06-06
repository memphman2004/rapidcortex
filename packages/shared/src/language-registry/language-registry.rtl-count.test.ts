import { describe, expect, it } from "vitest";
import { DEFAULT_SUPPORTED_CALL_LANGUAGES, getLanguageByCode, SUPPORTED_CALL_LANGUAGE_CODES } from "../call-languages.js";

describe("language registry completeness", () => {
  it("has >= 100 default rows", () => {
    expect(DEFAULT_SUPPORTED_CALL_LANGUAGES.length).toBeGreaterThanOrEqual(100);
  });

  it("retains the legacy supported call-language codes used by older deployments", () => {
    for (const code of SUPPORTED_CALL_LANGUAGE_CODES) {
      expect(getLanguageByCode(code)?.code.toLowerCase()).toBeTruthy();
    }
  });

  it("marks rtl languages", () => {
    expect(getLanguageByCode("ar")?.direction).toBe("rtl");
    expect(getLanguageByCode("he")?.direction).toBe("rtl");
    expect(getLanguageByCode("fa")?.direction).toBe("rtl");
    expect(getLanguageByCode("ur")?.direction).toBe("rtl");
  });

  it("does not enable speech pipelines for every supplemental language row", () => {
    const withStt = DEFAULT_SUPPORTED_CALL_LANGUAGES.filter((l) => l.capabilities.speechToText);
    expect(withStt.length).toBeLessThan(DEFAULT_SUPPORTED_CALL_LANGUAGES.length / 4);
  });
});
