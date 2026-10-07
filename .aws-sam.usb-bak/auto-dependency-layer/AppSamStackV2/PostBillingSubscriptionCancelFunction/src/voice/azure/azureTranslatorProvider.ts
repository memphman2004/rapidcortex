import type { ITranslationProvider, TranslationResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

type TranslateRow = { translations: { text: string; to: string }[] };

export class AzureTranslatorProvider implements ITranslationProvider {
  readonly name: string;
  private keyMemo: Promise<string> | null = null;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string },
  ) {
    this.name = opts?.name ?? "azure-translator";
  }

  private async resolveKey(): Promise<string> {
    this.keyMemo ??= resolvePlainOrSecretArn(
      this.cfg.azureTranslatorKey,
      this.cfg.azureTranslatorKeySecretArn,
      { preferredField: "azureTranslationKey" },
    );
    const key = await this.keyMemo;
    if (!key) {
      throw new VoiceProviderError("Azure Translator key missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
        retryable: false,
      });
    }
    return key;
  }

  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: "en",
    options?: { signal?: AbortSignal },
  ): Promise<TranslationResult> {
    const src = sourceLanguage.split("-")[0]?.toLowerCase() ?? "auto";
    if (targetLanguage !== "en") {
      return { translated: text, confidence: 0.5, sourceLanguage: src, targetLanguage: "en" };
    }
    if (src === "en") {
      return { translated: text, confidence: 1, sourceLanguage: "en", targetLanguage: "en" };
    }
    const key = await this.resolveKey();
    const region = this.cfg.azureTranslatorRegion.trim() || "eastus";
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${encodeURIComponent(src)}&to=en`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ text: text.slice(0, 10_000) }]),
      signal: options?.signal,
    });
    if (!res.ok) {
      throw new VoiceProviderError(`Azure translate HTTP ${res.status}`, VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
        httpStatus: res.status,
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    const rows = (await res.json()) as TranslateRow[];
    const translated = rows[0]?.translations?.[0]?.text?.trim() ?? "";
    if (!translated) {
      throw new VoiceProviderError("Azure translate empty", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
        retryable: false,
      });
    }
    return {
      translated,
      confidence: 0.9,
      sourceLanguage: src,
      targetLanguage: "en",
    };
  }
}
