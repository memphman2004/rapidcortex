import type { ITranslationProvider, TranslationResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import {
  resolveGoogleServiceAccountCredentials,
  type GoogleServiceAccountCredentials,
} from "./googleCredentials.js";
import { getGoogleAccessToken } from "./googleAccessToken.js";
import { googleTranslateV2 } from "./googleCloudTranslationRest.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";
import { toTranslatePrimaryTag } from "rapid-cortex-shared";

export class GoogleTranslationProvider implements ITranslationProvider {
  readonly name: string;
  private credsMemo: Promise<GoogleServiceAccountCredentials> | null = null;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string },
  ) {
    this.name = opts?.name ?? "google-translate";
  }

  private async creds(): Promise<GoogleServiceAccountCredentials> {
    this.credsMemo ??= resolveGoogleServiceAccountCredentials(this.cfg);
    return this.credsMemo;
  }

  async translate(
    text: string,
    sourceLanguage: string,
    targetLanguage: "en",
    options?: { signal?: AbortSignal },
  ): Promise<TranslationResult> {
    if (targetLanguage !== "en") {
      return { translated: text, confidence: 0.5, sourceLanguage: toTranslatePrimaryTag(sourceLanguage), targetLanguage: "en" };
    }
    const src = toTranslatePrimaryTag(sourceLanguage);
    if (src === "en") {
      return { translated: text, confidence: 1, sourceLanguage: "en", targetLanguage: "en" };
    }
    const creds = await this.creds();
    const token = await getGoogleAccessToken(creds, ["https://www.googleapis.com/auth/cloud-platform"]);
    const out = await googleTranslateV2({
      accessToken: token,
      text,
      source: src === "und" ? undefined : src,
      target: "en",
      signal: options?.signal,
    });
    const detected = out.detectedSourceLanguage
      ? toTranslatePrimaryTag(out.detectedSourceLanguage)
      : src;
    if (!out.translatedText) {
      throw new VoiceProviderError("Google translate empty", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
        retryable: false,
      });
    }
    return {
      translated: out.translatedText,
      confidence: 0.9,
      sourceLanguage: detected || src,
      targetLanguage: "en",
    };
  }
}
