import {
  GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
  callAssistVoiceVarsFromTenant,
  interpolateCallAssistVoice,
} from "rapid-cortex-shared";
import { ingestConnectCallerIdentity } from "../telephony/ani-ali.js";
import { getAgencyIdByDid, getLexTenantConfig } from "./runtime-store.js";

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
  if (!agencyId) {
    const agencyShortName = "this agency";
    return {
      agencyId: "default",
      disclosureText: interpolateCallAssistVoice(GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE, { agencyShortName }),
      language: "en",
      agencyShortName,
      ani: identity.ani ?? "",
      aliAddress: identity.aliAddress ?? "",
      apartmentSuite: identity.apartmentSuite ?? "",
    };
  }
  const config = await getLexTenantConfig(agencyId);
  const agencyShortName = config.agencyShortName ?? config.shortName ?? "this agency";
  return {
    agencyId,
    disclosureText: interpolateCallAssistVoice(
      config.disclosureText || GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
      callAssistVoiceVarsFromTenant(config),
    ),
    language: config.defaultLanguageCode?.startsWith("es") ? "es" : "en",
    agencyShortName,
    ani: identity.ani ?? "",
    aliAddress: identity.aliAddress ?? "",
    apartmentSuite: identity.apartmentSuite ?? "",
  };
}
