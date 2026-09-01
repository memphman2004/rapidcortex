import { SUPPORTED_CALL_LANGUAGE_CODES, normalizeCallLanguageCode } from "rapid-cortex-shared";

/** Azure Speech short-phrase locale (Mandarin default for `zh`; Cantonese not in v1 allowlist). */
export function toAzureSttLocale(canonical: string | undefined): string {
  const c = normalizeCallLanguageCode(canonical);
  const map: Record<string, string> = {
    en: "en-US",
    es: "es-US",
    zh: "zh-CN",
    tl: "fil-PH",
    vi: "vi-VN",
    ar: "ar-SA",
    fr: "fr-FR",
    ko: "ko-KR",
    ru: "ru-RU",
    pt: "pt-BR",
    und: "en-US",
  };
  return map[c] ?? "en-US";
}

/** Azure Neural TTS voice for supported call languages. */
export function toAzureTtsVoice(
  canonical: string | undefined,
  preferredGender?: "FEMALE" | "MALE" | "NEUTRAL",
): { locale: string; voiceName: string } {
  const locale = toAzureSttLocale(canonical);
  const male = preferredGender === "MALE";
  const table: Record<string, { female: string; male: string }> = {
    "en-US": { female: "en-US-JennyNeural", male: "en-US-GuyNeural" },
    "es-US": { female: "es-US-PalomaNeural", male: "es-US-AlonsoNeural" },
    "zh-CN": { female: "zh-CN-XiaoxiaoNeural", male: "zh-CN-YunxiNeural" },
    "fil-PH": { female: "fil-PH-BlessicaNeural", male: "fil-PH-AngeloNeural" },
    "vi-VN": { female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural" },
    "ar-SA": { female: "ar-SA-ZariyahNeural", male: "ar-SA-HamedNeural" },
    "fr-FR": { female: "fr-FR-DeniseNeural", male: "fr-FR-HenriNeural" },
    "ko-KR": { female: "ko-KR-SunHiNeural", male: "ko-KR-InJoonNeural" },
    "ru-RU": { female: "ru-RU-SvetlanaNeural", male: "ru-RU-DmitryNeural" },
    "pt-BR": { female: "pt-BR-FranciscaNeural", male: "pt-BR-AntonioNeural" },
  };
  const row = table[locale] ?? table["en-US"]!;
  return { locale, voiceName: male ? row.male : row.female };
}

export function toGoogleSttLanguageCode(canonical: string | undefined): string {
  const c = normalizeCallLanguageCode(canonical);
  const map: Record<string, string> = {
    en: "en-US",
    es: "es-US",
    zh: "cmn-Hans-CN",
    tl: "fil-PH",
    vi: "vi-VN",
    ar: "ar-XA",
    fr: "fr-FR",
    ko: "ko-KR",
    ru: "ru-RU",
    pt: "pt-BR",
    und: "en-US",
  };
  return map[c] ?? "en-US";
}

export { toAwsTranscribeLanguageCode } from "./aws/transcribeLanguageMapping.js";

/** Amazon Translate uses ISO codes; `zh` maps to `zh` (simplified default). */
export function toAwsTranslateCode(canonical: string | undefined): string {
  const c = normalizeCallLanguageCode(canonical);
  if (c === "zh") return "zh";
  return c === "und" ? "auto" : c;
}

export function googleAlternativeLanguageCodes(primary: string): string[] {
  const p = normalizeCallLanguageCode(primary);
  const all = [...SUPPORTED_CALL_LANGUAGE_CODES].map((x) => toGoogleSttLanguageCode(x));
  const primaryLc = toGoogleSttLanguageCode(p);
  const uniq: string[] = [];
  for (const x of all) {
    if (x !== primaryLc && !uniq.includes(x)) uniq.push(x);
    if (uniq.length >= 3) break;
  }
  return uniq;
}
