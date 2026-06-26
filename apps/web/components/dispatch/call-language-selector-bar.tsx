"use client";

/**
 * Language directory types + legacy re-exports.
 * Prefer `CallerLanguageBar` from `./caller-language-bar` for incident-scoped caller language.
 */

export type CapabilityBlock = {
  translation: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
  realTimeVoice: boolean;
  callerSms: boolean;
  dispatcherUi: boolean;
};

export type CallIntelligenceLanguageRow = {
  code: string;
  name: string;
  nativeName?: string;
  direction?: "ltr" | "rtl";
  emergencyPriority?: string;
  capabilities: CapabilityBlock;
  providers?: { translation?: string[] };
};

export {
  CallerLanguageBar,
  CallerLanguageBar as CallLanguageSelectorBar,
} from "./caller-language-bar";
