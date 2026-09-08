import { GENERIC_DISCLOSURE_TEXT } from "rapid-cortex-shared";
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
 * Nothing here is hardcoded to KCPD — the seed writes the DID lookup row.
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
    return {
      agencyId: "default",
      disclosureText: GENERIC_DISCLOSURE_TEXT,
      language: "en",
      agencyShortName: "this agency",
    };
  }
  const config = await getLexTenantConfig(agencyId);
  return {
    agencyId,
    disclosureText: config.disclosureText,
    language: "en",
    agencyShortName: config.agencyShortName ?? config.shortName ?? "this agency",
  };
}
