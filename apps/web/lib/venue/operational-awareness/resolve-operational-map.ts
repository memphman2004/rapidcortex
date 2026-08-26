import type { VenueOperationalMap } from "rapid-cortex-shared";
import { isMbsDemoVenue, MBS_DEMO_OPERATIONAL_MAP } from "./mbs-demo-map";

/**
 * Resolve the operational map for a venue.
 * MBS uses the illustrative demo catalog. Other venues get the same SVG
 * template retitled until they supply their own configuration.
 */
export function resolveVenueOperationalMap(
  venueId: string,
  venueName?: string,
): VenueOperationalMap {
  if (isMbsDemoVenue(venueId)) {
    return MBS_DEMO_OPERATIONAL_MAP;
  }
  const id = venueId.trim().toUpperCase() || "VENUE";
  const name = venueName?.trim() || id;
  return {
    ...MBS_DEMO_OPERATIONAL_MAP,
    venueId: id,
    name,
    isDemo: true,
    zones: MBS_DEMO_OPERATIONAL_MAP.zones.map((z) => ({ ...z, venueId: id })),
    assets: MBS_DEMO_OPERATIONAL_MAP.assets.map((a) => ({ ...a, venueId: id })),
    entrances: MBS_DEMO_OPERATIONAL_MAP.entrances.map((e) => ({ ...e, venueId: id })),
  };
}

export function defaultFacilityLevelId(map: VenueOperationalMap): string {
  const enabled = map.levels.filter((l) => l.enabled && l.id !== "exterior");
  return enabled.find((l) => l.id === "level-1")?.id ?? enabled[0]?.id ?? map.levels[0]?.id ?? "level-1";
}
