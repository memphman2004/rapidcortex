import {
  GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
  callAssistVoiceVarsFromTenant,
  interpolateCallAssistVoice,
} from "rapid-cortex-shared";
import { getAgencyIdByDid, getLexTenantConfig } from "./runtime-store.js";

export type ConnectStartEvent = {
  Details?: {
    Parameters?: Record<string, string>;
    ContactData?: {
      SystemEndpoint?: { Address?: string };
      CustomerEndpoint?: { Address?: string };
    };
  };
  phoneNumber?: string;
};

function phoneFromEvent(event: ConnectStartEvent): string {
  return (
    event.Details?.Parameters?.phoneNumber?.trim() ||
    event.Details?.ContactData?.SystemEndpoint?.Address?.trim() ||
    event.phoneNumber?.trim() ||
    ""
  );
}

/**
 * Amazon Connect Lambda: resolve tenant config from the called DID.
 * Voice copy is interpolated from that tenant — nothing is hardcoded to a city or agency.
 */
export async function handler(event: ConnectStartEvent): Promise<{
  agencyId: string;
  disclosureText: string;
  language: string;
  agencyShortName: string;
}> {
  const phoneNumber = phoneFromEvent(event);
  const agencyId = phoneNumber ? await getAgencyIdByDid(phoneNumber) : null;
  if (!agencyId) {
    const agencyShortName = "this agency";
    return {
      agencyId: "default",
      disclosureText: interpolateCallAssistVoice(GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE, { agencyShortName }),
      language: "en",
      agencyShortName,
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
  };
}
