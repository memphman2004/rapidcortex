import { redactForAgency } from "../eido/redact.js";
import type { EidoEnvelope } from "../eido/types.js";
import { REDACTION_POLICIES, type AgencyType } from "./policies.js";

export class RedactionEngine {
  redact(eido: EidoEnvelope, receivingAgencyType: AgencyType): EidoEnvelope {
    const policy = REDACTION_POLICIES[receivingAgencyType] ?? REDACTION_POLICIES.FIRE;
    return redactForAgency(eido, policy);
  }
}
