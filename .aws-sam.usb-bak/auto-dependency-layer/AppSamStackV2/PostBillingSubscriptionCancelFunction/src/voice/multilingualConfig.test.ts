import { describe, expect, it, afterEach } from "vitest";
import {
  getMultilingualVoiceConfig,
  isMultilingualStrictValidationEnabled,
  resetMultilingualVoiceConfigForTests,
  validateMultilingualDeploymentConfig,
} from "./multilingualConfig.js";

describe("getMultilingualVoiceConfig", () => {
  afterEach(() => {
    resetMultilingualVoiceConfigForTests();
    delete process.env.MULTILINGUAL_STRICT_VALIDATION;
    delete process.env.DEPLOYMENT_STAGE;
    delete process.env.PRIMARY_LANGUAGE_DETECTOR;
    delete process.env.PRIMARY_TRANSLATION_PROVIDER;
    delete process.env.PRIMARY_STT_PROVIDER;
    delete process.env.SECONDARY_STT_PROVIDER;
    delete process.env.TERTIARY_STT_PROVIDER;
    delete process.env.ASSETS_BUCKET;
    delete process.env.AWS_TRANSCRIBE_LANGUAGE_IDENTIFICATION;
    delete process.env.AWS_TRANSCRIBE_LANGUAGE_OPTIONS;
    delete process.env.AWS_TRANSCRIBE_PREFERRED_LANGUAGE_OPTIONS;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY_SECRET_ARN;
  });

  it("maps legacy aws_comprehend / aws_translate env values to aws", () => {
    process.env.PRIMARY_LANGUAGE_DETECTOR = "aws_comprehend";
    process.env.PRIMARY_TRANSLATION_PROVIDER = "aws_translate";
    process.env.PRIMARY_STT_PROVIDER = "aws";
    const cfg = getMultilingualVoiceConfig();
    expect(cfg.primaryLanguageDetector).toBe("aws");
    expect(cfg.primaryTranslationProvider).toBe("aws");
    expect(cfg.primarySttProvider).toBe("aws");
  });

  it("strict validation defaults on for staging when env unset", () => {
    process.env.DEPLOYMENT_STAGE = "staging";
    delete process.env.MULTILINGUAL_STRICT_VALIDATION;
    resetMultilingualVoiceConfigForTests();
    expect(isMultilingualStrictValidationEnabled()).toBe(true);
  });

  it("validateMultilingualDeploymentConfig returns issues when strict and Azure primary without credentials", () => {
    process.env.MULTILINGUAL_STRICT_VALIDATION = "true";
    process.env.PRIMARY_STT_PROVIDER = "azure";
    process.env.SECONDARY_STT_PROVIDER = "off";
    process.env.TERTIARY_STT_PROVIDER = "off";
    process.env.AZURE_SPEECH_KEY = "";
    process.env.AZURE_SPEECH_KEY_SECRET_ARN = "";
    resetMultilingualVoiceConfigForTests();
    const issues = validateMultilingualDeploymentConfig();
    expect(issues.some((i) => i.includes("Azure Speech"))).toBe(true);
  });

  it("validateMultilingualDeploymentConfig flags OpenAI Whisper STT missing key", () => {
    process.env.MULTILINGUAL_STRICT_VALIDATION = "true";
    process.env.PRIMARY_STT_PROVIDER = "azure";
    process.env.SECONDARY_STT_PROVIDER = "openai";
    process.env.TERTIARY_STT_PROVIDER = "off";
    process.env.AZURE_SPEECH_KEY_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:000:secret:fake";
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY_SECRET_ARN;
    resetMultilingualVoiceConfigForTests();
    const issues = validateMultilingualDeploymentConfig();
    expect(issues.some((i) => i.includes("OpenAI Whisper"))).toBe(true);
  });

  it("validateMultilingualDeploymentConfig flags openai used in non-STT tier", () => {
    process.env.MULTILINGUAL_STRICT_VALIDATION = "true";
    process.env.PRIMARY_TRANSLATION_PROVIDER = "openai";
    process.env.PRIMARY_STT_PROVIDER = "off";
    process.env.SECONDARY_STT_PROVIDER = "off";
    process.env.TERTIARY_STT_PROVIDER = "off";
    resetMultilingualVoiceConfigForTests();
    const issues = validateMultilingualDeploymentConfig();
    expect(issues.some((i) => i.toLowerCase().includes("openai") && i.includes("STT"))).toBe(true);
  });

  it("validateMultilingualDeploymentConfig flags AWS Transcribe IdentifyLanguage pool under two codes", () => {
    process.env.MULTILINGUAL_STRICT_VALIDATION = "true";
    process.env.PRIMARY_STT_PROVIDER = "off";
    process.env.SECONDARY_STT_PROVIDER = "off";
    process.env.TERTIARY_STT_PROVIDER = "aws";
    process.env.ASSETS_BUCKET = "bucket";
    process.env.AWS_TRANSCRIBE_LANGUAGE_IDENTIFICATION = "true";
    process.env.AWS_TRANSCRIBE_LANGUAGE_OPTIONS = "en-US";
    process.env.AWS_TRANSCRIBE_PREFERRED_LANGUAGE_OPTIONS = "";
    resetMultilingualVoiceConfigForTests();
    const issues = validateMultilingualDeploymentConfig();
    expect(issues.some((i) => i.includes("IdentifyLanguage"))).toBe(true);
  });
});
