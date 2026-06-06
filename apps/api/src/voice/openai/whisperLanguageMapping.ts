import { normalizeCallLanguageCode } from "rapid-cortex-shared";

/**
 * Whisper / `gpt-4o-transcribe` accept ISO 639-1 codes via the `language` field
 * (e.g. `en`, `es`, `zh`, `pt`). Our canonical call-language registry already
 * normalizes to ISO 639-1, so this mapping is mostly an identity, with two
 * caveats:
 *  - `und` (unknown) → `undefined`, so we omit the hint and let Whisper detect.
 *  - Languages outside the explicit Whisper supported list resolve to `undefined`
 *    rather than passing an unknown code (which Whisper rejects with HTTP 400).
 *
 * Source: https://platform.openai.com/docs/guides/speech-to-text/supported-languages
 *
 * The 10 Rapid Cortex call languages (`en, es, zh, tl, vi, ar, fr, ko, ru, pt`)
 * are all in Whisper's supported list, including Tagalog (`tl`).
 */
const WHISPER_SUPPORTED_ISO_639_1: ReadonlySet<string> = new Set([
  "af", "ar", "az", "be", "bg", "bs", "ca", "cs", "cy", "da",
  "de", "el", "en", "es", "et", "fa", "fi", "fr", "gl", "he",
  "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "kk", "kn",
  "ko", "lt", "lv", "mi", "mk", "mr", "ms", "ne", "nl", "no",
  "pa", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv", "sw",
  "ta", "th", "tl", "tr", "uk", "ur", "vi", "zh",
]);

/**
 * Returns the ISO 639-1 language hint for the OpenAI Whisper / transcribe API,
 * or `undefined` to let the API auto-detect.
 *
 * Auto-detect is preferred over passing a wrong hint: Whisper's detector is
 * solid, and a wrong hint actively degrades transcription quality.
 */
export function toWhisperLanguageHint(canonical: string | undefined): string | undefined {
  const c = normalizeCallLanguageCode(canonical);
  if (c === "und") return undefined;
  return WHISPER_SUPPORTED_ISO_639_1.has(c) ? c : undefined;
}
