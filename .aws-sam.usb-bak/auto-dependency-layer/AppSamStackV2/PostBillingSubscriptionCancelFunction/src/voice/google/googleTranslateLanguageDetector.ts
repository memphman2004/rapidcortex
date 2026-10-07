import { normalizeCallLanguageCode } from "rapid-cortex-shared";
import type { ILanguageDetector, LanguageDetectionResult } from "../interfaces.js";
import type { MultilingualVoiceConfig } from "../multilingualConfig.js";
import {
  resolveGoogleServiceAccountCredentials,
  type GoogleServiceAccountCredentials,
} from "./googleCredentials.js";
import { getGoogleAccessToken } from "./googleAccessToken.js";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

type DetectResponse = {
  data?: {
    detections?: { language: string; confidence: number; isReliable?: boolean }[][];
  };
};

export class GoogleTranslateLanguageDetector implements ILanguageDetector {
  readonly name: string;
  private credsMemo: Promise<GoogleServiceAccountCredentials> | null = null;

  constructor(
    private readonly cfg: MultilingualVoiceConfig,
    opts?: { name?: string },
  ) {
    this.name = opts?.name ?? "google-translate-detect";
  }

  private async creds(): Promise<GoogleServiceAccountCredentials> {
    this.credsMemo ??= resolveGoogleServiceAccountCredentials(this.cfg);
    return this.credsMemo;
  }

  async detectFromText(text: string, options?: { signal?: AbortSignal }): Promise<LanguageDetectionResult> {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      return { language: "und", confidence: 0, alternatives: [], detectionMethod: "google_translate" };
    }
    const creds = await this.creds();
    const token = await getGoogleAccessToken(creds, ["https://www.googleapis.com/auth/cloud-platform"]);
    const url = "https://translation.googleapis.com/language/translate/v2/detect";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: trimmed.slice(0, 10_000) }),
      signal: options?.signal,
    });
    if (!res.ok) {
      throw new VoiceProviderError(`Google detect HTTP ${res.status}`, VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
        httpStatus: res.status,
        retryable: res.status === 429 || res.status >= 500,
      });
    }
    const json = (await res.json()) as DetectResponse;
    const list = json.data?.detections?.[0] ?? [];
    const top = list[0];
    if (!top?.language) {
      return { language: "und", confidence: 0, alternatives: [], detectionMethod: "google_translate" };
    }
    const language = normalizeCallLanguageCode(top.language);
    const confidence = typeof top.confidence === "number" ? top.confidence : 0.7;
    const alternatives = list.slice(1, 4).map((d) => ({
      language: normalizeCallLanguageCode(d.language),
      confidence: d.confidence ?? 0,
    }));
    return { language, confidence, alternatives, detectionMethod: "google_translate" };
  }
}
