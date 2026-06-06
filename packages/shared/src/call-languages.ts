/**
 * Legacy top-10 call-routing codes plus shared registry helpers.
 * `SUPPORTED_CALL_LANGUAGE_CODES` is retained for backward-compatible imports.
 * Full defaults live in `DEFAULT_SUPPORTED_CALL_LANGUAGES` (100+ entries).
 */
export const SUPPORTED_CALL_LANGUAGE_CODES = [
  "en",
  "es",
  "zh",
  "tl",
  "vi",
  "ar",
  "fr",
  "ko",
  "ru",
  "pt",
] as const;

export type SupportedCallLanguageCode = (typeof SUPPORTED_CALL_LANGUAGE_CODES)[number];

export {
  DEFAULT_SUPPORTED_CALL_LANGUAGES,
  mergeProviderLanguageCapabilities,
  getLanguageByCode,
  getLanguagesByCapability,
  getSupportedCallLanguages,
  normalizeLanguageCode,
  parseSupportedCallLanguagesEnv,
  parseSupportedCallLanguagesEnvDetailed,
  type ParseSupportedCallLanguagesOptions,
} from "./language-registry/language-registry.js";

export type {
  SupportedLanguage,
  SupportedLanguage as RegistrySupportedLanguage,
} from "./language-registry/language-registry.js";

export { isSupportedCallLanguage } from "./language-registry/language-registry.js";

/**
 * Normalize provider / detector output to Rapid Cortex call-language primary subtags for live-call routing.
 * Prefer {@link normalizeLanguageCode} for canonical registry / translation UI keys.
 */
export function normalizeCallLanguageCode(raw: string | undefined): string {
  if (!raw) return "und";
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "und";
  const primary = trimmed.split("-")[0] ?? trimmed;
  if (primary === "und" || primary === "auto") return "und";
  if (primary === "zh" || primary.startsWith("zh")) return "zh";
  if (primary === "yue" || primary.startsWith("yue")) return "zh";
  if (primary === "fil" || primary === "tl") return "tl";
  if (primary === "iw") return "he";
  if (primary === "in") return "id";
  return primary;
}
