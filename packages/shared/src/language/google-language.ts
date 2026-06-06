/**
 * Safe helpers for Google Cloud Translation / Text-to-Speech language codes.
 * Uses BCP-47–style input and maps to API-friendly primary subtags where needed.
 */

/** ISO 639-1 codes that typically use a non-Latin script (heuristic for UI hints). */
const NON_LATIN_PRIMARY = new Set([
  "ar",
  "hy",
  "bn",
  "zh",
  "ka",
  "el",
  "gu",
  "he",
  "hi",
  "ja",
  "km",
  "ko",
  "lo",
  "ml",
  "mr",
  "my",
  "ne",
  "pa",
  "fa",
  "ru",
  "sr",
  "si",
  "ta",
  "te",
  "th",
  "ti",
  "uk",
  "ur",
  "yi",
  "ii",
  "bo",
  "dz",
  "am",
]);

/** Google Translate v2 / AWS–compatible primary language code (lowercase). */
export function toTranslatePrimaryTag(bcp: string | undefined): string {
  if (!bcp || !bcp.trim()) return "und";
  const base = bcp.trim().split("-")[0]!.toLowerCase();
  if (base.length < 2) return "und";
  return base;
}

/**
 * Best-effort Google TTS BCP-47 `languageCode` (e.g. `en-US`, `es-ES`).
 * Neural2/Standard voices are chosen separately by the synthesizer.
 */
export function toGoogleTtsLanguageCode(bcp: string | undefined, fallback: string = "en-US"): string {
  if (!bcp || !bcp.trim()) return fallback;
  const t = bcp.trim();
  if (t.includes("-")) {
    const [a, b] = t.split("-");
    if (a && b && /^[A-Za-z]{2}$/.test(a) && /^[A-Za-z0-9]{2,3}$/i.test(b)) {
      return `${a.toLowerCase()}-${b.toUpperCase()}`;
    }
  }
  const primary = toTranslatePrimaryTag(t);
  const defaultRegion: Record<string, string> = {
    en: "en-US",
    es: "es-US",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-BR",
    ru: "ru-RU",
    ja: "ja-JP",
    ko: "ko-KR",
    zh: "cmn-Hans",
    ar: "ar-XA",
    hi: "hi-IN",
    vi: "vi-VN",
    tl: "fil-PH",
  };
  return defaultRegion[primary] ?? `${primary}-${primary.toUpperCase()}`;
}

export function isLikelyRightToLeftLanguage(bcp: string | undefined): boolean {
  const p = toTranslatePrimaryTag(bcp);
  return p === "ar" || p === "he" || p === "fa" || p === "ur" || p === "ps";
}

export function isNonLatinScriptLanguage(bcp: string | undefined): boolean {
  return NON_LATIN_PRIMARY.has(toTranslatePrimaryTag(bcp));
}
