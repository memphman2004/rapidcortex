import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMultilingualVoiceConfigForTests } from "../../voice/multilingualConfig.js";
import { runLanguageDetectionChain } from "../../voice/languageDetection/languageDetectionOrchestrator.js";
import { buildLanguageDetectorChain } from "../../voice/languageDetection/languageDetectorFactory.js";
import * as google from "./googleTranslateClient.js";
import * as azure from "./azureTranslatorText.js";
import * as azureTts from "../../voice/azure/azureSpeechTts.js";
import * as openaiTts from "../../voice/openai/openaiTts.js";
import {
  detectLanguage,
  resolveTextTranslationBackend,
  synthesizeTextWithConfiguredProvider,
  translateFromEnglish,
  translateToEnglish,
} from "./languageProviderFactory.js";

vi.mock("./googleTranslateClient.js", () => ({
  googleMultilingualTranslateToEnglish: vi.fn(),
  googleMultilingualTranslateFromEnglish: vi.fn(),
  googleMultilingualDetectLanguage: vi.fn(),
  resetCredsForTests: vi.fn(),
}));
vi.mock("./azureTranslatorText.js", () => ({
  azureTranslatorTranslateText: vi.fn(),
}));
vi.mock("../../voice/languageDetection/languageDetectionOrchestrator.js", () => ({
  runLanguageDetectionChain: vi.fn(),
}));
vi.mock("../../voice/languageDetection/languageDetectorFactory.js", () => ({ buildLanguageDetectorChain: vi.fn() }));
vi.mock("../../voice/azure/azureSpeechTts.js", () => ({ azureSpeechSynthesize: vi.fn() }));
vi.mock("../../voice/openai/openaiTts.js", () => ({ openaiTtsSynthesize: vi.fn() }));
vi.mock("../../voice/google/googleTextToSpeechRest.js", () => ({ googleTextToSpeechSynthesize: vi.fn() }));
vi.mock("../../voice/google/googleAccessToken.js", () => ({ getGoogleAccessToken: vi.fn() }));
vi.mock("../../voice/google/googleCredentials.js", () => ({ resolveGoogleServiceAccountCredentials: vi.fn() }));

const base = () => {
  process.env.SUPPORTED_CALL_LANGUAGES = "en,es,zh,tl,vi,ar,fr,ko,ru,pt";
  process.env.LANGUAGE_PROVIDER = "auto";
  process.env.GOOGLE_CLOUD_PROJECT_ID = "";
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "";
  process.env.GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN = "";
  process.env.AZURE_TRANSLATION_KEY = "";
  process.env.AZURE_SPEECH_KEY = "";
  process.env.TRANSLATION_PRIMARY_PROVIDER = "azure-translator";
  process.env.TRANSLATION_FALLBACK_PROVIDER = "google-translate";
};

describe("resolveTextTranslationBackend", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    base();
  });

  it("uses google when LANGUAGE_PROVIDER=google and project is set", () => {
    process.env.LANGUAGE_PROVIDER = "google";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account","project_id":"p1"}';
    resetMultilingualVoiceConfigForTests();
    expect(resolveTextTranslationBackend()).toBe("google");
  });

  it("auto uses aws when Google project is missing", () => {
    process.env.LANGUAGE_PROVIDER = "auto";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "";
    resetMultilingualVoiceConfigForTests();
    expect(resolveTextTranslationBackend()).toBe("aws");
  });

  it("auto prefers google when project and inline credentials are present", () => {
    process.env.LANGUAGE_PROVIDER = "auto";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account","project_id":"p1","private_key":"x"}';
    resetMultilingualVoiceConfigForTests();
    expect(resolveTextTranslationBackend()).toBe("google");
  });
});

describe("translateToEnglish", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    base();
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account","project_id":"p1"}';
    vi.mocked(google.googleMultilingualTranslateToEnglish).mockReset();
    vi.mocked(azure.azureTranslatorTranslateText).mockReset();
  });

  it("falls back to Google when Azure credentials are unavailable", async () => {
    resetMultilingualVoiceConfigForTests();
    vi.mocked(google.googleMultilingualTranslateToEnglish).mockResolvedValue({
      text: "Hello",
      sourceLanguage: "es",
      targetLanguage: "en",
      confidence: 0.9,
    });
    const r = await translateToEnglish("Hola", "es-US");
    expect(r.text).toBe("Hello");
    expect(r.targetLanguage).toBe("en");
    expect(r.provider).toBe("google-translate");
  });

  it("uses Azure Translator when credentials are configured", async () => {
    process.env.AZURE_TRANSLATION_KEY = "k";
    resetMultilingualVoiceConfigForTests();
    vi.mocked(azure.azureTranslatorTranslateText).mockResolvedValue({ translatedText: "Hello" });
    const r = await translateToEnglish("Hola", "es");
    expect(r.text).toBe("Hello");
    expect(r.provider).toBe("azure-translator");
  });
});

describe("translateFromEnglish", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    base();
    vi.mocked(google.googleMultilingualTranslateFromEnglish).mockReset();
    vi.mocked(azure.azureTranslatorTranslateText).mockReset();
  });

  it("uses Google when Azure credentials are missing", async () => {
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account","project_id":"p1"}';
    resetMultilingualVoiceConfigForTests();
    vi.mocked(google.googleMultilingualTranslateFromEnglish).mockResolvedValue({
      text: "Hola",
      sourceLanguage: "en",
      targetLanguage: "es",
      confidence: 0.9,
    });
    const r = await translateFromEnglish("Hi", "es");
    expect(r.text).toBe("Hola");
    expect(r.provider).toBe("google-translate");
  });

  it("throws for unsupported call language", async () => {
    process.env.SUPPORTED_CALL_LANGUAGES = "en,es";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account","project_id":"p1"}';
    resetMultilingualVoiceConfigForTests();
    await expect(translateFromEnglish("Hi", "xx")).rejects.toThrow();
  });
});

describe("detectLanguage", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    base();
  });

  it("uses Google when text backend is google", async () => {
    process.env.LANGUAGE_PROVIDER = "google";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account"}';
    resetMultilingualVoiceConfigForTests();
    vi.mocked(google.googleMultilingualDetectLanguage).mockResolvedValue({ language: "es", confidence: 0.95 });
    const d = await detectLanguage("Hola");
    expect(d.provider).toBe("google-detect");
    expect(d.language).toBe("es");
  });

  it("uses detection chain for aws text backend", async () => {
    process.env.LANGUAGE_PROVIDER = "aws";
    resetMultilingualVoiceConfigForTests();
    vi.mocked(buildLanguageDetectorChain).mockReturnValue([{ name: "mock" }] as never);
    vi.mocked(runLanguageDetectionChain).mockResolvedValue({
      language: "es",
      confidence: 0.7,
      alternatives: [],
      detectionMethod: "comprehend",
    });
    const d = await detectLanguage("Hola there");
    expect(d.provider).toBe("comprehend");
  });
});

describe("synthesizeTextWithConfiguredProvider", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    base();
    process.env.SILENT_TEXT_TTS_ENABLED = "true";
    process.env.PROVIDER_ENABLE_FALLBACKS = "true";
    process.env.ASSETS_BUCKET = "";
    process.env.AZURE_SPEECH_KEY = "k";
    process.env.OPENAI_API_KEY = "";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = "";
    vi.mocked(azureTts.azureSpeechSynthesize).mockReset();
    vi.mocked(openaiTts.openaiTtsSynthesize).mockReset();
  });

  it("uses Azure Neural TTS when Speech credentials are set", async () => {
    resetMultilingualVoiceConfigForTests();
    vi.mocked(azureTts.azureSpeechSynthesize).mockResolvedValue({
      audioContent: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/mpeg",
      voiceName: "en-US-JennyNeural",
      languageCode: "en-US",
      encoding: "MP3",
    });
    const r = await synthesizeTextWithConfiguredProvider(
      { text: "Hello", languageBcp: "en" },
      { agencyId: "a1", sessionId: "s1", messageId: "m1" },
    );
    expect(r.voiceName).toBe("en-US-JennyNeural");
    expect(azureTts.azureSpeechSynthesize).toHaveBeenCalledOnce();
  });

  it("falls back to OpenAI TTS when Azure fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    resetMultilingualVoiceConfigForTests();
    vi.mocked(azureTts.azureSpeechSynthesize).mockRejectedValue(new Error("Azure TTS HTTP 429"));
    vi.mocked(openaiTts.openaiTtsSynthesize).mockResolvedValue({
      audioContent: new Uint8Array(48).fill(9),
      mimeType: "audio/mpeg",
      voiceName: "nova",
      languageCode: "es",
      encoding: "MP3",
    });
    const r = await synthesizeTextWithConfiguredProvider(
      { text: "Hola", languageBcp: "es" },
      { agencyId: "a1", sessionId: "s1", messageId: "m1" },
    );
    expect(r.voiceName).toBe("nova");
  });

  it("throws when TTS is disabled", async () => {
    process.env.SILENT_TEXT_TTS_ENABLED = "false";
    resetMultilingualVoiceConfigForTests();
    await expect(
      synthesizeTextWithConfiguredProvider(
        { text: "Hi", languageBcp: "en" },
        { agencyId: "a1", sessionId: "s1", messageId: "m1" },
      ),
    ).rejects.toThrow(/TTS disabled/);
  });
});
