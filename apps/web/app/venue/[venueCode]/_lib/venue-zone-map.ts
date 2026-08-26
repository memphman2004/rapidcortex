import type { QRLocation } from "rapid-cortex-shared";
import type { VenueZone } from "./venue-types";

/** Next RCLI zone code (`RC101`, `RC102`, …) from existing location records. */
export function nextRcZoneCode(zoneCodes: Iterable<string>): string {
  let max = 100;
  for (const raw of zoneCodes) {
    const match = /^RC(\d+)$/.exec(raw.trim().toUpperCase());
    if (match) max = Math.max(max, Number.parseInt(match[1]!, 10));
  }
  return `RC${max + 1}`;
}

export function normalizeVenueZoneCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function locationToVenueZone(location: QRLocation, venueCode: string): VenueZone {
  const code = normalizeVenueZoneCode(location.zone || location.zoneCode);
  const org = venueCode.toUpperCase();
  return {
    id: location.rcli,
    venueCode: org,
    code,
    label: location.locationName,
    level: location.building?.trim() || location.floor?.trim() || "General",
    cameraIds: [],
    qrUrl: `/report/${org}/${encodeURIComponent(code)}`,
    activeIncidents: 0,
  };
}

export function mergeVenueZones(live: VenueZone[], fixtures: VenueZone[]): VenueZone[] {
  const codes = new Set(live.map((zone) => zone.code.toUpperCase()));
  return [...live, ...fixtures.filter((zone) => !codes.has(zone.code.toUpperCase()))];
}
