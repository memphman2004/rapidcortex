import { describe, expect, it, afterEach } from "vitest";
import { buildSttProviderChain } from "./sttProviderFactory.js";
import { getMultilingualVoiceConfig, resetMultilingualVoiceConfigForTests } from "../multilingualConfig.js";

describe("buildSttProviderChain", () => {
  afterEach(() => {
    resetMultilingualVoiceConfigForTests();
    delete process.env.PRIMARY_STT_PROVIDER;
    delete process.env.SECONDARY_STT_PROVIDER;
    delete process.env.TERTIARY_STT_PROVIDER;
    delete process.env.ASSETS_BUCKET;
    delete process.env.OPENAI_API_KEY;
  });

  it("registers aws tier as AwsTranscribeSttProvider", () => {
    process.env.PRIMARY_STT_PROVIDER = "azure";
    process.env.SECONDARY_STT_PROVIDER = "google";
    process.env.TERTIARY_STT_PROVIDER = "aws";
    process.env.ASSETS_BUCKET = "b";
    resetMultilingualVoiceConfigForTests();
    const chain = buildSttProviderChain(getMultilingualVoiceConfig());
    expect(chain).toHaveLength(3);
    expect(chain.map((p) => p.name)).toEqual(["azure-stt-primary", "google-stt-secondary", "aws-transcribe-tertiary"]);
  });

  it("registers azure -> openai-whisper -> aws chain when secondary is openai", () => {
    process.env.PRIMARY_STT_PROVIDER = "azure";
    process.env.SECONDARY_STT_PROVIDER = "openai";
    process.env.TERTIARY_STT_PROVIDER = "aws";
    process.env.ASSETS_BUCKET = "b";
    process.env.OPENAI_API_KEY = "sk-test";
    resetMultilingualVoiceConfigForTests();
    const chain = buildSttProviderChain(getMultilingualVoiceConfig());
    expect(chain).toHaveLength(3);
    expect(chain.map((p) => p.name)).toEqual([
      "azure-stt-primary",
      "openai-whisper-secondary",
      "aws-transcribe-tertiary",
    ]);
  });

  it("normalizes legacy `openai-whisper` env value to `openai` kind", () => {
    process.env.PRIMARY_STT_PROVIDER = "azure";
    process.env.SECONDARY_STT_PROVIDER = "openai-whisper";
    process.env.TERTIARY_STT_PROVIDER = "off";
    resetMultilingualVoiceConfigForTests();
    const chain = buildSttProviderChain(getMultilingualVoiceConfig());
    expect(chain.map((p) => p.name)).toContain("openai-whisper-secondary");
  });
});
