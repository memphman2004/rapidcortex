import type { RedactionPolicy } from "../eido/redact.js";

export type AgencyType = "LAW_ENFORCEMENT" | "FIRE" | "EMS" | "COMBINED";

export const REDACTION_POLICIES: Record<AgencyType, RedactionPolicy> = {
  LAW_ENFORCEMENT: {
    redactedFields: [],
    allowCJI: true,
  },
  FIRE: {
    redactedFields: [
      "eido.incident.SubjectInfo.CriminalHistory",
      "eido.incident.SubjectInfo.WarrantsIndicator",
      "eido.incident.LESpecificNotes",
    ],
    allowCJI: false,
  },
  EMS: {
    redactedFields: [
      "eido.incident.SubjectInfo.CriminalHistory",
      "eido.incident.SubjectInfo.WarrantsIndicator",
      "eido.incident.LESpecificNotes",
    ],
    allowCJI: false,
    hipaaDataAllowed: true,
  },
  COMBINED: {
    redactedFields: [],
    allowCJI: true,
  },
};
