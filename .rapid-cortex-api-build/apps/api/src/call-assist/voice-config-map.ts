import type { CallAssistAgencyVoiceConfig, CallAssistLocale } from "rapid-cortex-shared";
import {
  CONNECT_LIVE_LEX_LOCALES,
  callLanguageToLexLocale,
  normalizePreferredLanguage,
} from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "./store.js";

function localesFromTenant(config: CallAssistTenantConfig): CallAssistLocale[] {
  if (config.supportedLocales?.length) return config.supportedLocales;
  const langs = config.supportedLanguages?.length ? config.supportedLanguages : ["en-US"];
  const set = new Set<CallAssistLocale>(["en_US"]);
  for (const lang of langs) {
    const lex = callLanguageToLexLocale(normalizePreferredLanguage(lang));
    if ((CONNECT_LIVE_LEX_LOCALES as readonly string[]).includes(lex)) {
      set.add(lex as CallAssistLocale);
    }
  }
  return [...set];
}

export function tenantToVoiceConfig(config: CallAssistTenantConfig): CallAssistAgencyVoiceConfig {
  const locales = localesFromTenant(config);
  return {
    agencyId: config.agencyId,
    agencyName: config.agencyName || config.agencyShortName || "this agency",
    agencyDisplayName: config.agencyDisplayName || config.agencyName,
    agencyShortName: config.agencyShortName || config.shortName || "this agency",
    agencyTypeLabel: config.agencyTypeLabel,
    officerLabel: config.officerLabel || "officer",
    emergencyLine: config.emergencyLine || config.emergencyDestination || "911",
    nonEmergencyWebsite: config.nonEmergencyWebsite,
    onlineReportPortalUrl: config.onlineReportUrl,
    carfaxPortalUrl: config.carfaxPortalUrl,
    defaultLanguageCode: config.defaultLanguageCode || "en-US",
    supportedLanguages: config.supportedLanguages || ["en-US"],
    defaultLocale: config.defaultLocale || "en_US",
    supportedLocales: locales,
    lexBotId: config.lexBotId,
    lexBotAliasId: config.lexBotAliasId,
    lexBotName: config.lexBotName,
    lexBotTemplateVersion: config.lexBotTemplateVersion,
    lexBotStatus: config.lexBotStatus as CallAssistAgencyVoiceConfig["lexBotStatus"],
    connectInstanceId: config.connectInstanceId,
    connectContactFlowId: config.connectContactFlowId,
    connectContactFlowArn: config.connectContactFlowArn,
    connectNonEmergencyDID: config.connectNonEmergencyDID || config.testDID,
    connectQueueArn: config.connectQueueArn,
    connectEmergencyQueueArn: config.connectEmergencyQueueArn,
    transcribeVocabularyName: config.transcribeVocabularyName,
    transcribeVocabularyStatus: config.transcribeVocabularyStatus as CallAssistAgencyVoiceConfig["transcribeVocabularyStatus"],
    disclosureEnabled: config.disclosureEnabled,
    disclosureText: config.disclosureText,
    aiDisclosureRequired: config.aiDisclosureRequired,
    openingGreeting: config.openingGreeting,
    afterHoursMessage: config.afterHoursMessage,
    onboardingStatus: config.onboardingStatus as CallAssistAgencyVoiceConfig["onboardingStatus"],
  };
}
