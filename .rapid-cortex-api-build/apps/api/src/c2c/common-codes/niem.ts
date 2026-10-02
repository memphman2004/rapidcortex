import type { ISO8601, NIEMEnvelope } from "../eido/types.js";

export function wrapInNIEM<T>(payload: T, messageType: string, organizationId: string): NIEMEnvelope<T> {
  const now = new Date().toISOString() as ISO8601;
  return {
    "nc:Message": {
      "nc:MessageID": crypto.randomUUID(),
      "nc:MessageDateTime": now,
      "nc:MessageSubmittalOrganization": {
        "nc:OrganizationIdentification": {
          "nc:IdentificationID": organizationId,
        },
      },
      "em:MessageContent": payload,
    },
  };
}

export function unwrapNIEM<T>(envelope: NIEMEnvelope<T>): T {
  return envelope["nc:Message"]["em:MessageContent"];
}
