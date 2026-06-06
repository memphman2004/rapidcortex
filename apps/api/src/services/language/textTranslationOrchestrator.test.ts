import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetMultilingualVoiceConfigForTests,
  getMultilingualVoiceConfig,
} from "../../voice/multilingualConfig.js";
import * as azure from "./azureTranslatorText.js";
import * as google from "./googleTranslateClient.js";
import { translateFromEnglishOrchestrated } from "./textTranslationOrchestrator.js";

vi.mock("./azureTranslatorText.js", () => ({
  azureTranslatorTranslateText: vi.fn(),
}));
vi.mock("./googleTranslateClient.js", () => ({
  googleMultilingualTranslateFromEnglish: vi.fn(),
}));

describe("translateFromEnglishOrchestrated fallbacks", () => {
  beforeEach(() => {
    resetMultilingualVoiceConfigForTests();
    process.env.TRANSLATION_PRIMARY_PROVIDER = "azure-translator";
    process.env.TRANSLATION_FALLBACK_PROVIDER = "google-translate";
    process.env.SUPPORTED_CALL_LANGUAGES = "en,es";
    process.env.GOOGLE_CLOUD_PROJECT_ID = "p1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '{"type":"service_account"}';
    process.env.AZURE_TRANSLATION_KEY = "";
    vi.mocked(azure.azureTranslatorTranslateText).mockReset();
    vi.mocked(google.googleMultilingualTranslateFromEnglish).mockReset();
  });

  it("uses Google Translate only after Azure is unavailable without credentials", async () => {
    resetMultilingualVoiceConfigForTests();
    vi.mocked(google.googleMultilingualTranslateFromEnglish).mockResolvedValue({
      text: "Hola",
      sourceLanguage: "en",
      targetLanguage: "es",
      confidence: 0.9,
    });
    const cfg = getMultilingualVoiceConfig();
    const out = await translateFromEnglishOrchestrated(cfg, "Hello", "es-US", {});
    expect(out.provider).toBe("google-translate");
    expect(google.googleMultilingualTranslateFromEnglish).toHaveBeenCalledTimes(1);
  });
});
