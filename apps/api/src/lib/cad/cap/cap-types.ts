/**
 * CAP 1.2 types and RC normalization shapes.
 * Spec: https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html
 */

export type CapStatus =
  | "Actual"
  | "Exercise"
  | "System"
  | "Test"
  | "Draft";

export type CapMsgType = "Alert" | "Update" | "Cancel" | "Ack" | "Error";

export type CapScope = "Public" | "Restricted" | "Private";

export type CapCategory =
  | "Geo"
  | "Met"
  | "Safety"
  | "Security"
  | "Rescue"
  | "Fire"
  | "Health"
  | "Env"
  | "Transport"
  | "Infra"
  | "CBRNE"
  | "Other";

export type CapUrgency = "Immediate" | "Expected" | "Future" | "Past" | "Unknown";

export type CapSeverity = "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";

export type CapCertainty = "Observed" | "Likely" | "Possible" | "Unlikely" | "Unknown";

export type CapResponseType =
  | "Shelter"
  | "Evacuate"
  | "Prepare"
  | "Execute"
  | "Avoid"
  | "Monitor"
  | "Assess"
  | "AllClear"
  | "None";

export interface CapGeocode {
  valueName: string;
  value: string;
}

export interface CapArea {
  areaDesc: string;
  polygon?: string;
  circle?: string;
  geocodes: CapGeocode[];
}

export interface CapResource {
  resourceDesc: string;
  mimeType: string;
  uri?: string;
}

export interface CapInfo {
  language?: string;
  categories: CapCategory[];
  event: string;
  responseTypes: CapResponseType[];
  urgency: CapUrgency;
  severity: CapSeverity;
  certainty: CapCertainty;
  audience?: string;
  effective?: string;
  onset?: string;
  expires?: string;
  senderName?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  web?: string;
  contact?: string;
  areas: CapArea[];
  resources: CapResource[];
  parameters: Record<string, string>;
}

export interface CapAlert {
  identifier: string;
  sender: string;
  sent: string;
  status: CapStatus;
  msgType: CapMsgType;
  source?: string;
  scope: CapScope;
  restriction?: string;
  addresses?: string;
  codes: string[];
  note?: string;
  references?: string;
  incidents?: string;
  infos: CapInfo[];
  rawXml: string;
}

export type CapRcPriority = "P1" | "P2" | "P3" | "P4";

export interface NormalizedCapIncident {
  capIdentifier: string;
  capSender: string;
  capSentAt: string;
  fipsCodes: string[];
  routedAgencyId?: string;
  incidentType: string;
  category: CapCategory;
  priority: CapRcPriority;
  headline: string;
  description?: string;
  instruction?: string;
  areaDesc: string;
  polygon?: string;
  latitude?: number;
  longitude?: number;
  effective?: string;
  onset?: string;
  expires?: string;
  msgType: CapMsgType;
  updatesIdentifiers: string[];
  severity: CapSeverity;
  urgency: CapUrgency;
  certainty: CapCertainty;
  responseTypes: CapResponseType[];
  source: "cap_direct" | "ipaws_feed";
  receivedAt: string;
}

/** IPAWS OPEN API emergency alert priority mapping. Immediate is never below P2. */
export function capToPriority(urgency: CapUrgency, severity: CapSeverity): CapRcPriority {
  if (urgency === "Immediate") {
    if (severity === "Extreme" || severity === "Severe") return "P1";
    return "P2";
  }
  if (urgency === "Expected") {
    if (severity === "Extreme") return "P1";
    if (severity === "Severe" || severity === "Moderate") return "P2";
    return "P3";
  }
  if (urgency === "Future") {
    if (severity === "Extreme" || severity === "Severe") return "P2";
    return "P3";
  }
  return "P4";
}

export type CapIngestStatus =
  | "received"
  | "routed"
  | "no_agency"
  | "duplicate"
  | "skipped"
  | "parse_error";

export interface CadCapRecord {
  agencyId: string;
  sk: string;
  capIdentifier: string;
  capSender: string;
  capSentAt: string;
  status: CapIngestStatus;
  msgType: CapMsgType;
  capStatus: CapStatus;
  fipsCodes: string[];
  headline: string;
  incidentType: string;
  priority: CapRcPriority;
  areaDesc: string;
  rcIncidentId?: string;
  rawXml: string;
  receivedAt: string;
  ttl: number;
}

export interface AgencyFipsConfig {
  agencyId: string;
  integrationId?: string;
  fipsCodes: string[];
  acceptCapAlerts: boolean;
  capAuthToken?: string;
  acceptExercise?: boolean;
  acceptTest?: boolean;
}
