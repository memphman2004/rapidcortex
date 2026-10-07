import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveEnglishTranscriptFromChunk } from "./transcriptEnglishPipeline.js";
import { resetMultilingualVoiceConfigForTests } from "./multilingualConfig.js";

describe("resolveEnglishTranscriptFromChunk", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    process.env.ENABLE_TRANSLATION_TO_ENGLISH = "true";
    process.env.PRIMARY_TRANSLATION_PROVIDER = "mock";
    process.env.SECONDARY_TRANSLATION_PROVIDER = "off";
    process.env.TERTIARY_TRANSLATION_PROVIDER = "off";
    process.env.PRIMARY_LANGUAGE_DETECTOR = "mock";
    process.env.SECONDARY_LANGUAGE_DETECTOR = "off";
    process.env.TERTIARY_LANGUAGE_DETECTOR = "off";
    process.env.ENABLE_INTERPRETER_ESCALATION_FLAG = "true";
  });

  afterEach(() => {
    resetMultilingualVoiceConfigForTests();
  });

  it("passes through English-only legacy text", async () => {
    const r = await resolveEnglishTranscriptFromChunk({
      speaker: "caller",
      text: "There is smoke in the building",
    });
    expect(r.englishText).toContain("smoke");
    expect(r.needsInterpreterReview).toBe(false);
  });

  it("translates Spanish original using mock provider", async () => {
    const r = await resolveEnglishTranscriptFromChunk({
      speaker: "caller",
      originalLanguage: "es",
      originalTranscript: "fuego en la casa",
      text: "placeholder",
    });
    expect(r.englishText.toLowerCase()).toContain("fire");
    expect(r.originalLanguage).toBe("es");
  });

  it("flags interpreter review when language confidence is forced low", async () => {
    process.env.LANGUAGE_DETECTION_MIN_CONFIDENCE = "0.99";
    resetMultilingualVoiceConfigForTests();
    const r = await resolveEnglishTranscriptFromChunk({
      speaker: "caller",
      originalTranscript: "hola",
    });
    expect(r.needsInterpreterReview).toBe(true);
  });
});
