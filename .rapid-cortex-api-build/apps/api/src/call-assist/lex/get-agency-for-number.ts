import {
  CALL_ASSIST_LOCALE_META,
  CONNECT_LANGUAGE_MENU_PROMPT,
  CONNECT_LIVE_LEX_LOCALES,
  GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
  callAssistVoiceVarsFromTenant,
  connectLivePrompts,
  connectLocaleAttrSuffix,
  interpolateCallAssistVoice,
  resolveConnectStartLocale,
} from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "../store.js";
import { ingestConnectCallerIdentity } from "../telephony/ani-ali.js";
import { getAgencyIdByDid, getLexTenantConfig } from "./runtime-store.js";
import { isCallAssistGreetingConfigEnabled, startCallAssistSession } from "./session-start.js";

export type ConnectStartEvent = {
  Details?: {
    Parameters?: Record<string, string>;
    ContactData?: {
      SystemEndpoint?: { Address?: string };
      CustomerEndpoint?: { Address?: string };
      Attributes?: Record<string, string>;
    };
  };
  phoneNumber?: string;
};

/** Flat STRING_MAP for Amazon Connect `$.External.*`. Extra greeting_* keys are per-locale. */
export type ConnectStartResult = {
  agencyId: string;
  disclosureText: string;
  greetingText: string;
  greetingMode: string;
  escalationMode: string;
  greetingDelivered: string;
  emergencyTransferNumber: string;
  emergencyTransferQueue: string;
  enableColdClimate: string;
  enableLiveAgentHandoff: string;
  language: string;
  languageMenuPrompt: string;
  transferPrompt: string;
  errorPrompt: string;
  transferFailPrompt: string;
  agencyShortName: string;
  ani: string;
  aliAddress: string;
  apartmentSuite: string;
} & Record<string, string>;

function phoneFromEvent(event: ConnectStartEvent): string {
  return (
    event.Details?.Parameters?.phoneNumber?.trim() ||
    event.Details?.ContactData?.SystemEndpoint?.Address?.trim() ||
    event.phoneNumber?.trim() ||
    ""
  );
}

export function identityFromConnectStart(event: ConnectStartEvent) {
  return ingestConnectCallerIdentity({
    ani: event.Details?.ContactData?.CustomerEndpoint?.Address ?? event.Details?.Parameters?.ani,
    attributes: {
      ...(event.Details?.ContactData?.Attributes ?? {}),
      ...(event.Details?.Parameters ?? {}),
    },
  });
}

export function eventLocaleHint(event: ConnectStartEvent): string | undefined {
  const raw =
    event.Details?.Parameters?.locale ?? event.Details?.ContactData?.Attributes?.language ?? "";
  return raw.trim() || undefined;
}

/**
 * Builds the Connect STRING_MAP used at call start: tenant default locale plus
 * per-locale greeting/transfer copy so the DTMF menu can switch without a second Lambda.
 */
export function buildConnectStartResult(opts: {
  agencyId: string;
  locale: string;
  config: CallAssistTenantConfig | null;
  identity: { ani?: string; aliAddress?: string; apartmentSuite?: string };
  agencyShortName: string;
}): ConnectStartResult {
  const locale = resolveConnectStartLocale({ eventLocale: opts.locale, tenantDefault: opts.locale });
  const start = startCallAssistSession({
    agencyId: opts.agencyId,
    locale,
    config: opts.config,
  });
  const defaultPrompts = connectLivePrompts(locale);
  const disclosureText = interpolateCallAssistVoice(
    opts.config?.disclosureText || GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
    opts.config ? callAssistVoiceVarsFromTenant(opts.config) : { agencyShortName: opts.agencyShortName },
  );
  const result: ConnectStartResult = {
    agencyId: opts.agencyId,
    disclosureText,
    greetingText: start.greeting,
    greetingMode: start.sessionAttributes.greetingMode ?? "stay_on_line",
    escalationMode: start.sessionAttributes.escalationMode ?? "announce_and_transfer",
    greetingDelivered: "true",
    emergencyTransferNumber:
      start.sessionAttributes.emergencyTransferNumber ?? opts.config?.emergencyDestination ?? "",
    emergencyTransferQueue:
      start.sessionAttributes.emergencyTransferQueue ?? opts.config?.connectEmergencyQueueArn ?? "",
    enableColdClimate: start.sessionAttributes.enableColdClimate ?? "false",
    enableLiveAgentHandoff: start.sessionAttributes.enableLiveAgentHandoff ?? "true",
    language: locale,
    languageMenuPrompt: CONNECT_LANGUAGE_MENU_PROMPT,
    transferPrompt: defaultPrompts.transfer,
    errorPrompt: defaultPrompts.error,
    transferFailPrompt: defaultPrompts.transferFail,
    agencyShortName: opts.agencyShortName,
    ani: opts.identity.ani ?? "",
    aliAddress: opts.identity.aliAddress ?? "",
    apartmentSuite: opts.identity.apartmentSuite ?? "",
  };

  for (const lex of CONNECT_LIVE_LEX_LOCALES) {
    const bcp47 = CALL_ASSIST_LOCALE_META[lex].bcp47;
    const localized = startCallAssistSession({
      agencyId: opts.agencyId,
      locale: bcp47,
      config: opts.config,
    });
    const prompts = connectLivePrompts(bcp47);
    const suffix = connectLocaleAttrSuffix(bcp47);
    result[`greeting_${suffix}`] = localized.greeting;
    result[`transferPrompt_${suffix}`] = prompts.transfer;
    result[`errorPrompt_${suffix}`] = prompts.error;
    result[`transferFailPrompt_${suffix}`] = prompts.transferFail;
  }
  return result;
}

/**
 * Amazon Connect Lambda: resolve tenant config from the called DID.
 * Voice copy is interpolated from that tenant — nothing is hardcoded to a city or agency.
 * ANI is the customer endpoint; ALI is a contact attribute when the PSAP or RapidSOS provides it.
 */
export async function handler(event: ConnectStartEvent): Promise<ConnectStartResult> {
  const identity = identityFromConnectStart(event);
  const phoneNumber = phoneFromEvent(event);
  const agencyId = phoneNumber ? await getAgencyIdByDid(phoneNumber) : null;
  const hinted = eventLocaleHint(event);

  if (!agencyId) {
    return buildConnectStartResult({
      agencyId: "default",
      locale: resolveConnectStartLocale({ eventLocale: hinted }),
      config: null,
      identity,
      agencyShortName: "this agency",
    });
  }

  const config = await getLexTenantConfig(agencyId);
  const locale = resolveConnectStartLocale({
    eventLocale: hinted,
    tenantDefault: config.defaultLanguageCode,
  });
  const agencyShortName = config.agencyShortName ?? config.shortName ?? "this agency";
  const result = buildConnectStartResult({
    agencyId,
    locale,
    config: isCallAssistGreetingConfigEnabled() ? config : null,
    identity,
    agencyShortName,
  });
  if (!isCallAssistGreetingConfigEnabled()) {
    result.agencyId = agencyId;
    result.disclosureText = interpolateCallAssistVoice(
      config.disclosureText || GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
      callAssistVoiceVarsFromTenant(config),
    );
    result.greetingText = result.disclosureText;
    result.emergencyTransferNumber = config.emergencyDestination ?? "";
    result.emergencyTransferQueue = config.connectEmergencyQueueArn ?? "";
  }
  return result;
}
