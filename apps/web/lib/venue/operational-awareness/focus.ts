import type { VenueDemoIncident, VenueOperationalMap } from "rapid-cortex-shared";
import type { RCIncident } from "@/components/maps/map-types";

export interface IncidentFocusTarget {
  incidentId: string;
  levelId: string;
  zoneId: string | null;
  entranceId: string | null;
  exteriorCoordinates: [number, number] | null;
  demo: VenueDemoIncident | null;
}

function normalizeHaystack(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function matchLiveIncidentToZone(map: VenueOperationalMap, locationLabel: string) {
  const needle = normalizeHaystack(locationLabel);
  if (!needle) return null;
  return (
    map.zones.find((zone) => zone.section && needle.includes(normalizeHaystack(zone.section))) ??
    map.zones.find((zone) => needle.includes(normalizeHaystack(zone.name))) ??
    null
  );
}

export function resolveIncidentFocus(
  map: VenueOperationalMap,
  incidentId: string | null | undefined,
  liveIncidents: RCIncident[] = [],
): IncidentFocusTarget | null {
  if (!incidentId) return null;

  const demo = map.demoIncidents?.find((item) => item.id === incidentId) ?? null;
  if (demo) {
    const staging =
      map.entrances.find((item) => item.id === "EMS-STAGING") ??
      map.entrances.find((item) => item.kind === "emergency") ??
      map.entrances.find((item) => item.id === "GATE-04") ??
      map.entrances[0];
    return {
      incidentId,
      levelId: demo.levelId,
      zoneId: demo.zoneId,
      entranceId: staging?.id ?? null,
      exteriorCoordinates: staging?.exteriorCoordinates ?? null,
      demo,
    };
  }

  const live = liveIncidents.find((item) => item.id === incidentId);
  const zone = live ? matchLiveIncidentToZone(map, live.locationLabel) : null;
  const coords: [number, number] | null =
    live?.longitude != null && live.latitude != null ? [live.longitude, live.latitude] : null;
  return {
    incidentId,
    levelId: zone?.levelId ?? map.levels.find((level) => level.id !== "exterior")?.id ?? "level-1",
    zoneId: zone?.id ?? null,
    entranceId: null,
    exteriorCoordinates: coords,
    demo: null,
  };
}

export function demoIncidentsToMap(map: VenueOperationalMap): RCIncident[] {
  const staging =
    map.entrances.find((item) => item.id === "EMS-STAGING") ??
    map.entrances.find((item) => item.kind === "emergency") ??
    map.entrances[0];
  return (map.demoIncidents ?? []).map((incident) => ({
    id: incident.id,
    status: incident.status === "dispatched" ? "responding" : "active",
    severity: incident.severity,
    type: incident.type,
    locationLabel: `${incident.locationLabel} · Section ${incident.section}`,
    latitude: staging?.exteriorCoordinates?.[1],
    longitude: staging?.exteriorCoordinates?.[0],
    createdAt: incident.reportedAt,
    description: `${incident.title} (demo)`,
  }));
}

export function statusLabel(status: string): string {
  const key = status.trim().toLowerCase();
  if (key === "dispatched") return "Response Dispatched";
  if (key === "responding") return "En Route";
  if (key === "open") return "Open";
  if (key === "assigned") return "Assigned";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
