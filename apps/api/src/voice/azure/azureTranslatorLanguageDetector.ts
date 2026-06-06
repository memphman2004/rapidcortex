import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import type { ILanguageDetector, LanguageDetectionResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

type DetectRow = { language: string; score: number };

export class AzureTranslatorLanguageDetector implements ILanguageDetector {
  readonly name: string;
  private keyMemo: Promise<string> | null = null;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string },
  ) {
    this.name = opts?.name ?? "azure-translator-detect";
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

  async detectFromText(text: string, options?: { signal?: AbortSignal }): Promise<LanguageDetectionResult> {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      return { language: "und", confidence: 0, alternatives: [], detectionMethod: "azure_translator" };
    }
    const key = await this.resolveKey();
    const region = this.cfg.azureTranslatorRegion.trim() || "eastus";
    const url = `https://api.cognitive.microsofttranslator.com/detect?api-version=3.0`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ text: trimmed.slice(0, 10_000) }]),
      signal: options?.signal,
    });
    if (!res.ok) {
      throw new VoiceProviderError(`Azure detect HTTP ${res.status}`, VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
        httpStatus: res.status,
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    const rows = (await res.json()) as DetectRow[];
    const top = rows[0];
    if (!top?.language) {
      return { language: "und", confidence: 0, alternatives: [], detectionMethod: "azure_translator" };
    }
    const language = normalizeCallLanguageCode(top.language);
    const confidence = typeof top.score === "number" ? top.score : 0.7;
    return {
      language,
      confidence,
      alternatives: rows.slice(1, 4).flatMap((r) =>
        r.language && r.score != null
          ? [{ language: normalizeCallLanguageCode(r.language), confidence: r.score }]
          : [],
      ),
      detectionMethod: "azure_translator",
    };
  }
}
