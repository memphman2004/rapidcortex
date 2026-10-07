import type { MultilingualVoiceConfig } from "../../voice/multilingualConfig.js";
import { resolvePlainOrSecretArn } from "../../lib/runtimeSecrets.js";
import { VoiceProviderError } from "../../voice/providerErrors.js";
import { VOICE_ERROR_CODES } from "../../voice/voiceErrorCodes.js";

type TranslateApiRow = { translations: { text: string; to: string }[] };

export function mapLocaleForAzureTranslator(code: string): string {
  const c = code.trim().toLowerCase();
  if (c === "tl" || c.startsWith("tl-")) return "fil";
  if (c === "fil") return "fil";
  /** Azure expects lowercase script tags where applicable */
  return c.replace(/_/g, "-");
}

async function resolveTranslatorKey(cfg: MultilingualVoiceConfig): Promise<string> {
  const k = await resolvePlainOrSecretArn(cfg.azureTranslatorKey, cfg.azureTranslatorKeySecretArn, {
    preferredField: "azureTranslationKey",
  });
  if (!k?.trim()) {
    throw new VoiceProviderError("Azure Translator key missing", VOICE_ERROR_CODES.PROVIDER_CONFIG_ERROR, {
      retryable: false,
    });
  }
  return k;
}

/**
 * General Azure Translator REST call (any supported language pair).
 */
export async function azureTranslatorTranslateText(opts: {
  cfg: MultilingualVoiceConfig;
  text: string;
  from: string;
  to: string;
  signal?: AbortSignal;
  agencyId?: string;
}): Promise<{ translatedText: string }> {
  const text = opts.text.trim().slice(0, 10_000);
  if (!text) {
    throw new VoiceProviderError("Empty text", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, { retryable: false });
  }
  const from = mapLocaleForAzureTranslator(opts.from);
  const to = mapLocaleForAzureTranslator(opts.to);
  if (from === to) {
    return { translatedText: text };
  }

  const key = await resolveTranslatorKey(opts.cfg);
  const region = opts.cfg.azureTranslatorRegion.trim() || "eastus";
  const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": region,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ text }]),
    signal: opts.signal,
  });

  if (!res.ok) {
    throw new VoiceProviderError(`Azure translate HTTP ${res.status}`, VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
      httpStatus: res.status,
      retryable: res.status === 429 || res.status >= 500,
    });
  }
  const rows = (await res.json()) as TranslateApiRow[];
  const translated = rows[0]?.translations?.[0]?.text?.trim() ?? "";
  if (!translated) {
    throw new VoiceProviderError("Azure translate empty", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, {
      retryable: false,
    });
  }
  return { translatedText: translated };
}
