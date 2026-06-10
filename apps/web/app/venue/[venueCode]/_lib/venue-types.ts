export type IncidentStatus = "open" | "assigned" | "responding" | "resolved" | "escalated";

export type IncidentSource = "qr" | "sms" | "manual" | "escalated_from_core";

export type IncidentType =
  | "medical"
  | "security"
  | "lost_person"
  | "maintenance"
  | "guest_services"
  | "other";

export interface VenueIncident {
  id: string;
  venueCode: string;
  zoneCode: string;
  zoneLabel: string;
  qrRcli?: string;
  qrLocationName?: string;
  type: IncidentType;
  source: IncidentSource;
  status: IncidentStatus;
  description: string;
  confidence: "high" | "medium" | "low";
  assignedTo: string | null;
  cameraRefs: string[];
  hasMedia: boolean;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface VenueZone {
  id: string;
  venueCode: string;
  code: string;
  label: string;
  level: string;
  cameraIds: string[];
  qrUrl: string;
  activeIncidents: number;
}

export interface VenueCamera {
  id: string;
  name: string;
  zoneCode: string;
  status: "online" | "offline" | "degraded";
  streamUrl: string | null;
}

export interface VenueStaffMember {
  id: string;
  name: string;
  role: string;
  status: "available" | "responding" | "off_duty";
  currentIncidentId: string | null;
  zone: string | null;
}
