export {
  type MultilingualProviderMode,
  isMultilingualProviderMode,
  parseMultilingualProviderMode,
} from "./multilingual-provider-mode.js";
export {
  isLikelyRightToLeftLanguage,
  isNonLatinScriptLanguage,
  toGoogleTtsLanguageCode,
  toTranslatePrimaryTag,
} from "./google-language.js";
export {
  type SynthesizeTextRequest,
  type SynthesizedUtterance,
  type TextToSpeechAudioEncoding,
} from "./text-to-speech.js";
