/**
 * Google Cloud Translation API v2 (REST) — shared by {@link GoogleTranslationProvider} and multilingual text services.
 * @see https://cloud.google.com/translate/docs/reference/rest/v2/translate
 */
import { toTranslatePrimaryTag } from "rapid-cortex-shared";
import { VoiceProviderError } from "../providerErrors.js";
import { VOICE_ERROR_CODES } from "../voiceErrorCodes.js";

const TRANSLATE_V2 = "https://translation.googleapis.com/language/translate/v2";
const DETECT_V2 = "https://translation.googleapis.com/language/translate/v2/detect";

export type GoogleTranslateV2Result = {
  translatedText: string;
  /** When source was auto, API may return detected source. */
  detectedSourceLanguage?: string;
};

/**
 * When `source` is omitted, Google auto-detects the language.
 */
export async function googleTranslateV2(args: {
  accessToken: string;
  text: string;
  /** ISO 639-1 primary tag or `auto` to omit (auto-detect). */
  source?: string;
  /** Target language (e.g. `en`, `es`). */
  target: string;
  signal?: AbortSignal;
}): Promise<GoogleTranslateV2Result> {
  const q = args.text.slice(0, 10_000);
  if (!q.trim()) {
    throw new VoiceProviderError("Empty text for Google translate", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  const body: Record<string, unknown> = {
    q,
    target: toTranslatePrimaryTag(args.target) || args.target,
    format: "text",
  };
  const src = args.source ? toTranslatePrimaryTag(args.source) : "";
  if (src && src !== "und" && src !== "auto") {
    body.source = src;
  }
  const res = await fetch(TRANSLATE_V2, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const code =
      res.status === 400 || res.status === 404
        ? VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE
        : res.status === 429
          ? VOICE_ERROR_CODES.TRANSLATION_RATE_LIMIT
          : res.status >= 500
            ? VOICE_ERROR_CODES.TRANSLATION_PROVIDER_5XX
            : VOICE_ERROR_CODES.UNKNOWN_PROVIDER_ERROR;
    throw new VoiceProviderError(`Google translate HTTP ${res.status} ${errText.slice(0, 400)}`, code, {
      httpStatus: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const json = (await res.json()) as {
    data?: { translations?: { translatedText?: string; detectedSourceLanguage?: string }[] };
  };
  const translated = json.data?.translations?.[0]?.translatedText?.trim() ?? "";
  if (!translated) {
    throw new VoiceProviderError("Google translate empty", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  return {
    translatedText: translated,
    detectedSourceLanguage: json.data?.translations?.[0]?.detectedSourceLanguage,
  };
}

export type GoogleDetectV2Result = {
  language: string;
  confidence: number;
};

/**
 * Returns best-effort BCP-47 / ISO code from the first detection entry.
 */
export async function googleDetectLanguageV2(args: {
  accessToken: string;
  text: string;
  signal?: AbortSignal;
}): Promise<GoogleDetectV2Result> {
  const q = args.text.slice(0, 10_000);
  if (!q.trim()) {
    return { language: "und", confidence: 0 };
  }
  const res = await fetch(DETECT_V2, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: [q] }),
    signal: args.signal,
  });
  if (!res.ok) {
    const dcode =
      res.status === 429
        ? VOICE_ERROR_CODES.TRANSLATION_RATE_LIMIT
        : res.status >= 500
          ? VOICE_ERROR_CODES.TRANSLATION_PROVIDER_5XX
          : VOICE_ERROR_CODES.LANG_DETECT_TIMEOUT;
    throw new VoiceProviderError(`Google detect HTTP ${res.status}`, dcode, {
      httpStatus: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const json = (await res.json()) as {
    data?: { detections?: { language?: string; confidence?: number; isReliable?: boolean }[][] };
  };
  const d = json.data?.detections?.[0]?.[0];
  const lang = toTranslatePrimaryTag(d?.language) || "und";
  const conf = typeof d?.confidence === "number" ? d.confidence : d?.isReliable ? 0.85 : 0.6;
  return { language: lang, confidence: Math.min(1, Math.max(0, conf)) };
}
