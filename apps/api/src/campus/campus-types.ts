export type CampusIncidentStatus =
  | "open"
  | "assigned"
  | "responding"
  | "resolved"
  | "referred"
  | "escalated";

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

export type CampusIncidentSource = "qr" | "sms" | "manual" | "phone";

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

export interface CampusSmsChatMessage {
  messageId: string;
  body: string;
  receivedAt: string;
}

export type CampusHelpType =
  | "medical"
  | "security"
  | "mental_health"
  | "suspicious_activity"
  | "wellness_check"
  | "property_crime"
  | "maintenance"
  | "active_threat"
  | "other";

export interface CampusIncident {
  pk: string; // CAMPUS#{campusCode}
  sk: string; // INCIDENT#{incidentId}
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
  cameraRefs: string[];
  hasMedia: boolean;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  cleryCategory: string | null;
  /** SHA-256 hash of reporter phone — never plain text. */
  phoneHash?: string;
  reporterLast4?: string;
  locationData?: CampusIncidentLocationEntry[];
  locationLinkSent?: boolean;
  smsChatMessages?: CampusSmsChatMessage[];
}

export interface CampusIncidentNote {
  noteId: string;
  incidentId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface CampusZone {
  code: string;
  label: string;
  buildingCode: string;
  buildingLabel: string;
  floor: number;
  roomCode: string;
  cameraIds: string[];
  qrUrl: string;
}

export interface CampusBuilding {
  id: string;
  campusCode: string;
  code: string;
  label: string;
  type:
    | "academic"
    | "residential"
    | "dining"
    | "athletic"
    | "administrative"
    | "outdoor";
  floors: number;
  capacity?: number;
  cameraIds: string[];
  activeIncidents: number;
  zones: CampusZone[];
}

export interface CampusAnalytics {
  totalIncidents: number;
  openIncidents: number;
  respondingNow: number;
  resolvedToday: number;
  confidentialReports: number;
  byType: Record<CampusIncidentType, number>;
  byBuilding: { buildingLabel: string; count: number }[];
  bySource: { qr: number; sms: number; manual: number; phone: number };
  avgResponseMinutes: number;
  escalatedToCore: number;
  referredToCounseling: number;
}

export interface CampusConfig {
  campusCode: string;
  campusName: string;
  smsEnabled: boolean;
  qrEnabled: boolean;
  active: boolean;
  cleryEnabled: boolean;
  cleryAcademicYear: string;
}

export interface CampusStaffMember {
  userId: string;
  campusCode: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

// DynamoDB key helpers
export const CAMPUS_KEYS = {
  incidentPk: (campusCode: string) => `CAMPUS#${campusCode}`,
  incidentSk: (incidentId: string) => `INCIDENT#${incidentId}`,
  configPk: (campusCode: string) => `CAMPUS_CONFIG#${campusCode}`,
  buildingSk: (code: string) => `BUILDING#${code}`,
  zoneSk: (code: string) => `ZONE#${code}`,
  staffSk: (userId: string) => `STAFF#${userId}`,
  settingsSk: () => "SETTINGS",
  anonTokenPk: (hashedToken: string) => `ANON_TOKEN#${hashedToken}`,
  anonTokenSk: () => "TOKEN",
  noteSk: (noteId: string) => `NOTE#${noteId}`,
} as const;
