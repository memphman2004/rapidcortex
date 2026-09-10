import {
  GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
  callAssistVoiceVarsFromTenant,
  interpolateCallAssistVoice,
} from "rapid-cortex-shared";
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
  agencyShortName: string;
  ani: string;
  aliAddress: string;
  apartmentSuite: string;
};

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

/**
 * Amazon Connect Lambda: resolve tenant config from the called DID.
 * Voice copy is interpolated from that tenant — nothing is hardcoded to a city or agency.
 * ANI is the customer endpoint; ALI is a contact attribute when the PSAP or RapidSOS provides it.
 */
export async function handler(event: ConnectStartEvent): Promise<ConnectStartResult> {
  const identity = identityFromConnectStart(event);
  const phoneNumber = phoneFromEvent(event);
  const agencyId = phoneNumber ? await getAgencyIdByDid(phoneNumber) : null;
  const locale = event.Details?.Parameters?.locale ?? event.Details?.ContactData?.Attributes?.language ?? "en-US";
  if (!agencyId) {
    const agencyShortName = "this agency";
    const start = startCallAssistSession({
      agencyId: "default",
      locale,
      config: null,
    });
    return {
      agencyId: "default",
      disclosureText: interpolateCallAssistVoice(GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE, { agencyShortName }),
      greetingText: start.greeting,
      greetingMode: start.sessionAttributes.greetingMode ?? "stay_on_line",
      escalationMode: start.sessionAttributes.escalationMode ?? "announce_and_transfer",
      greetingDelivered: "true",
      emergencyTransferNumber: "",
      emergencyTransferQueue: "",
      enableColdClimate: "false",
      enableLiveAgentHandoff: "true",
      language: "en",
      agencyShortName,
      ani: identity.ani ?? "",
      aliAddress: identity.aliAddress ?? "",
      apartmentSuite: identity.apartmentSuite ?? "",
    };
  }
  const config = await getLexTenantConfig(agencyId);
  const agencyShortName = config.agencyShortName ?? config.shortName ?? "this agency";
  const start = isCallAssistGreetingConfigEnabled()
    ? startCallAssistSession({ agencyId, locale, config })
    : null;
  const disclosureText = interpolateCallAssistVoice(
    config.disclosureText || GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
    callAssistVoiceVarsFromTenant(config),
  );
  return {
    agencyId,
    disclosureText,
    greetingText: start?.greeting ?? disclosureText,
    greetingMode: start?.sessionAttributes.greetingMode ?? "stay_on_line",
    escalationMode: start?.sessionAttributes.escalationMode ?? "announce_and_transfer",
    greetingDelivered: "true",
    emergencyTransferNumber: start?.sessionAttributes.emergencyTransferNumber ?? config.emergencyDestination ?? "",
    emergencyTransferQueue: start?.sessionAttributes.emergencyTransferQueue ?? config.connectEmergencyQueueArn ?? "",
    enableColdClimate: start?.sessionAttributes.enableColdClimate ?? "false",
    enableLiveAgentHandoff: start?.sessionAttributes.enableLiveAgentHandoff ?? "true",
    language: config.defaultLanguageCode?.startsWith("es") ? "es" : "en",
    agencyShortName,
    ani: identity.ani ?? "",
    aliAddress: identity.aliAddress ?? "",
    apartmentSuite: identity.apartmentSuite ?? "",
  };
}
