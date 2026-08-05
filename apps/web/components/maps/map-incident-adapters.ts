/**
 * Adapters: domain incidents → RCIncident for RapidCortexMap.
 */

import type { CampusIncident } from "@/lib/campus/types";
import type { VenueIncident } from "@/app/venue/[venueCode]/_lib/venue-types";
import type { Incident } from "rapid-cortex-shared";
import type { IncidentSeverity, IncidentStatus, RCIncident } from "./map-types";

function venueStatus(status: VenueIncident["status"]): IncidentStatus {
  switch (status) {
    case "responding":
    case "assigned":
      return "responding";
    case "resolved":
      return "resolved";
    case "escalated":
      return "active";
    case "open":
    default:
      return "active";
  }
}

function venueSeverity(inc: VenueIncident): IncidentSeverity {
  if (inc.status === "escalated" || inc.type === "security" || inc.type === "medical") {
    return "high";
  }
  if (inc.type === "lost_person") return "medium";
  if (inc.status === "resolved") return "resolved";
  return "low";
}

export function venueIncidentsToMap(incidents: VenueIncident[]): RCIncident[] {
  return incidents.map((inc) => ({
    id: inc.id,
    status: venueStatus(inc.status),
    severity: venueSeverity(inc),
    type: inc.type ?? "general",
    locationLabel: inc.zoneLabel || inc.qrLocationName || "Unknown Location",
    latitude: inc.latitude ?? undefined,
    longitude: inc.longitude ?? undefined,
    createdAt: inc.createdAt,
    description: inc.description,
  }));
}

function campusStatus(status: CampusIncident["status"]): IncidentStatus {
  switch (status) {
    case "responding":
    case "assigned":
      return "responding";
    case "resolved":
    case "referred":
      return "resolved";
    case "escalated":
    case "open":
    default:
      return "active";
  }
}

function campusSeverity(inc: CampusIncident): IncidentSeverity {
  if (inc.type === "active_threat") return "critical";
  if (inc.type === "medical" || inc.type === "security" || inc.status === "escalated") {
    return "high";
  }
  if (inc.type === "suspicious_activity" || inc.type === "mental_health") return "medium";
  if (inc.status === "resolved" || inc.status === "referred") return "resolved";
  return "low";
}

function campusCoords(inc: CampusIncident): { lat?: number; lng?: number } {
  const withCoords = [...(inc.locationData ?? [])]
    .reverse()
    .find((e) => e.coordinates?.latitude != null && e.coordinates?.longitude != null);
  if (!withCoords?.coordinates) return {};
  return {
    lat: withCoords.coordinates.latitude,
    lng: withCoords.coordinates.longitude,
  };
}

export function campusIncidentsToMap(incidents: CampusIncident[]): RCIncident[] {
  return incidents.map((inc) => {
    const { lat, lng } = campusCoords(inc);
    return {
      id: inc.id,
      status: campusStatus(inc.status),
      severity: campusSeverity(inc),
      type: inc.type ?? "general",
      locationLabel:
        inc.zoneLabel ||
        inc.buildingLabel ||
        inc.qrLocationName ||
        "Unknown Location",
      latitude: lat,
      longitude: lng,
      createdAt: inc.createdAt,
      description: inc.description,
    };
  });
}

function psapStatus(status: Incident["status"]): IncidentStatus {
  switch (status) {
    case "in_progress":
      return "responding";
    case "completed":
    case "archived":
      return "resolved";
    case "active":
    default:
      return "active";
  }
}

function psapSeverity(inc: Incident): IncidentSeverity {
  if (inc.escalationFlag || inc.urgency === "critical") return "critical";
  if (inc.urgency === "high") return "high";
  if (inc.urgency === "moderate") return "medium";
  if (inc.status === "completed" || inc.status === "archived") return "resolved";
  return "low";
}

export function psapIncidentsToMap(incidents: Incident[]): RCIncident[] {
  return incidents.map((inc) => {
    const lat =
      (typeof inc.callerLocationLat === "number" ? inc.callerLocationLat : undefined) ??
      (typeof inc.cadCoordinates?.lat === "number" ? inc.cadCoordinates.lat : undefined);
    const lng =
      (typeof inc.callerLocationLng === "number" ? inc.callerLocationLng : undefined) ??
      (typeof inc.cadCoordinates?.lng === "number" ? inc.cadCoordinates.lng : undefined);
    return {
      id: inc.incidentId,
      status: psapStatus(inc.status),
      severity: psapSeverity(inc),
      type: inc.category ?? "general",
      locationLabel:
        inc.callerLocationMapLabel ||
        inc.callerAddressLine ||
        inc.cadLocation ||
        inc.title ||
        "Unknown Location",
      latitude: lat,
      longitude: lng,
      createdAt: inc.createdAt,
      description: inc.summary,
      agencyId: inc.agencyId,
    };
  });
}
