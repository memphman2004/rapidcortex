/**
 * Google Cloud Translation helpers for **text** workflows (silent text, tooling).
 * Live call translation still uses {@link GoogleTranslationProvider} in `voice/google/`.
 */
export {
  googleMultilingualDetectLanguage,
  googleMultilingualTranslateFromEnglish,
  googleMultilingualTranslateToEnglish,
  resetCredsForTests,
} from "./googleTranslateClient.js";
