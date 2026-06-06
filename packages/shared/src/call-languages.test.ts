import { describe, expect, it } from "vitest";
import {
  normalizeCallLanguageCode,
  normalizeLanguageCode,
  parseSupportedCallLanguagesEnvDetailed,
  DEFAULT_SUPPORTED_CALL_LANGUAGES,
} from "./call-languages.js";

describe("normalizeCallLanguageCode", () => {
  it("maps zh variants and yue to zh bucket", () => {
    expect(normalizeCallLanguageCode("zh-CN")).toBe("zh");
    expect(normalizeCallLanguageCode("yue-HK")).toBe("zh");
  });

  it("maps fil to tl", () => {
    expect(normalizeCallLanguageCode("fil-PH")).toBe("tl");
  });
});

describe("parseSupportedCallLanguagesEnvDetailed", () => {
  it("defaults to full registry when unset", () => {
    const { codes } = parseSupportedCallLanguagesEnvDetailed(undefined, {});
    expect(codes.has("en")).toBe(true);
    expect(codes.has("zh")).toBe(true);
    expect(codes.size).toBeGreaterThanOrEqual(100);
  });

  it("always includes english unless opted out", () => {
    const { codes } = parseSupportedCallLanguagesEnvDetailed("es", {});
    expect(codes.has("en")).toBe(true);
    expect(codes.has("es")).toBe(true);
  });

  it("drops invalid tokens with warnings", () => {
    const w: string[] = [];
    const { codes, warnings } = parseSupportedCallLanguagesEnvDetailed("en,zzzz-not-real", {
      onWarning: (m) => w.push(m),
    });
    expect(codes.has("en")).toBe(true);
    expect(warnings.some((x) => x.includes("unsupported") || x.includes("ignored"))).toBe(true);
  });
});

describe("normalizeLanguageCode", () => {
  it("canonicalizes chinese script variants present in registry", () => {
    expect(normalizeLanguageCode("zh-CN")).toBe("zh-Hans");
  });
});

describe("registry sizing", () => {
  it("defines at least 100 default translation rows", () => {
    expect(DEFAULT_SUPPORTED_CALL_LANGUAGES.length).toBeGreaterThanOrEqual(100);
  });
});
