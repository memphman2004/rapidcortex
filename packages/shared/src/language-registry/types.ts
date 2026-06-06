export type TranslationProviderName = "azure-translator" | "google-translate";

export type LanguageCapability = {
  translation: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
  realTimeVoice: boolean;
  callerSms: boolean;
  dispatcherUi: boolean;
};

export type SupportedLanguage = {
  code: string;
  name: string;
  nativeName?: string;
  region?: string;
  direction?: "ltr" | "rtl";
  emergencyPriority?: "core" | "high" | "standard";
  capabilities: LanguageCapability;
  providers?: {
    translation?: TranslationProviderName[];
    speechToText?: string[];
    textToSpeech?: string[];
  };
};

export type EmergencyPriorityTier = "core" | "high" | "standard";
