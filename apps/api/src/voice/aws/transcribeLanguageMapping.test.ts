import { describe, expect, it } from "vitest";
import {
  AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS,
  AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS,
  buildAwsTranscribeIdentifyLanguageOptions,
  parseCommaSeparatedBcp47,
  toAwsTranscribeLanguageCode,
} from "./transcribeLanguageMapping.js";

describe("transcribeLanguageMapping", () => {
  it("maps internal codes to AWS batch LanguageCode", () => {
    expect(toAwsTranscribeLanguageCode("es")).toBe("es-US");
    expect(toAwsTranscribeLanguageCode("tl")).toBe("tl-PH");
    expect(toAwsTranscribeLanguageCode("zh")).toBe("zh-CN");
  });

  it("parses CSV with whitespace", () => {
    expect(parseCommaSeparatedBcp47(" en-US , es-US ")).toEqual(["en-US", "es-US"]);
  });

  it("builds at most five options with preferred order first", () => {
    const pool = "en-US,es-US,zh-CN,tl-PH,vi-VN,ar-SA,fr-FR,ko-KR,ru-RU,pt-BR";
    const out = buildAwsTranscribeIdentifyLanguageOptions(pool, "fr-FR,pt-BR");
    expect(out).toHaveLength(AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS);
    expect(out[0]).toBe("fr-FR");
    expect(out[1]).toBe("pt-BR");
    expect(out.length).toBeLessThanOrEqual(AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS);
    expect(out.length).toBeGreaterThanOrEqual(AWS_TRANSCRIBE_MIN_IDENTIFY_LANGUAGE_OPTIONS);
  });

  it("fills from default pool when csv empty", () => {
    const out = buildAwsTranscribeIdentifyLanguageOptions("", "");
    expect(out).toHaveLength(AWS_TRANSCRIBE_MAX_IDENTIFY_LANGUAGE_OPTIONS);
  });
});
