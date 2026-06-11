export type CampusIncidentStatus =
  | "open"
  | "assigned"
  | "responding"
  | "resolved"
  | "referred"
  | "escalated";

export type CampusIncidentSource = "qr" | "sms" | "manual" | "phone";

export type CampusIncidentType =
  | "medical"
  | "security"
  | "mental_health"
  | "suspicious_activity"
  | "wellness_check"
  | "property_crime"
  | "maintenance"
  | "active_threat"
  | "other";

export type CampusLocationSource = "GPS" | "CELL_TOWER" | "MANUAL";

export interface CampusIncidentLocationEntry {
  source: CampusLocationSource;
  accuracyMeters?: number;
  receivedAt: string;
  locationText?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number;
  };
}

export interface CampusIncident {
  id: string;
  campusCode: string;
  buildingCode: string;
  buildingLabel: string;
  floor: number | null;
  roomCode: string;
  zoneCode?: string;
  zoneLabel: string;
  qrRcli?: string;
  qrLocationName?: string;
  type: CampusIncidentType;
  source: CampusIncidentSource;
  status: CampusIncidentStatus;
  description: string;
  isAnonymous: boolean;
  confidential: boolean;
  assignedTo: string | null;
  assignedToName: string | null;
  hasMedia: boolean;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporterLast4?: string;
  locationData?: CampusIncidentLocationEntry[];
  locationLinkSent?: boolean;
}
