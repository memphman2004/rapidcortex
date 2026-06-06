/**
 * Vertical-specific marketing/sales packaging — same API surface, different GTM narrative.
 */

export type RcLiteVerticalMarketId =
  | "psap_911"
  | "campus_police"
  | "hospital_security"
  | "utilities_field"
  | "transportation_ops"
  | "private_security"
  | "schools_threat"
  | "manufacturing_safety";

export type RcLiteVerticalMarket = {
  id: RcLiteVerticalMarketId;
  label: string;
  packageName: string;
  description: string;
};

export const RC_LITE_VERTICAL_MARKETS: readonly RcLiteVerticalMarket[] = [
  {
    id: "psap_911",
    label: "911 / PSAP",
    packageName: "Emergency Intelligence API",
    description: "Dispatch-grade intelligence, multilingual understanding, QA surfaces for ECC workflows.",
  },
  {
    id: "campus_police",
    label: "Campus Safety",
    packageName: "Campus Safety API",
    description: "Student/campus policing incident triage hooks for CAD-adjacent systems.",
  },
  {
    id: "hospital_security",
    label: "Hospitals",
    packageName: "Security Incident API",
    description: "Clinical-campus security escalation without EMS PSAP overlays.",
  },
  {
    id: "utilities_field",
    label: "Utilities",
    packageName: "Field Incident API",
    description: "Field crew safety narratives, hazmat escalation, multilingual crews.",
  },
  {
    id: "transportation_ops",
    label: "Transportation",
    packageName: "Operations Safety API",
    description: "Transit operations incident classification and multilingual passenger contact.",
  },
  {
    id: "private_security",
    label: "Private Security",
    packageName: "Dispatch Intelligence API",
    description: "Corporate dispatch stacks that need audited intelligence payloads.",
  },
  {
    id: "schools_threat",
    label: "Schools",
    packageName: "Threat Reporting API",
    description: "Anonymous/silent reporting ingestion with escalation metadata.",
  },
  {
    id: "manufacturing_safety",
    label: "Manufacturing Safety",
    packageName: "Safety Incident API",
    description: "Plant-floor incident ingestion for EHS tooling without PSAP overlays.",
  },
];
