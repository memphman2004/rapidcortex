export type CallAssistGisZone = {
  id: string;
  name: string;
  /** Closed or open ring of [lng, lat] vertices. */
  polygon: Array<[number, number]>;
};

export type CallAssistGisAssignment = {
  addressConfidence: number;
  locationSource: "GIS" | "ANI_ALI" | "RAPIDSOS" | "CALLER" | "UNKNOWN";
  zoneId?: string;
  zoneName?: string;
  jurisdictionMatch?: boolean;
  jurisdictionLabel?: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
};

function ringContains(lng: number, lat: number, ring: Array<[number, number]>): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function assignCallAssistZone(
  lng: number,
  lat: number,
  zones: CallAssistGisZone[] | null | undefined,
): { zoneId: string; zoneName: string } | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  for (const zone of zones ?? []) {
    if (ringContains(lng, lat, zone.polygon)) return { zoneId: zone.id, zoneName: zone.name };
  }
  return null;
}

export function addressConfidenceFromGeocode(opts: {
  geocodeConfidence?: number | null;
  locationSource?: CallAssistGisAssignment["locationSource"] | null;
  hasText?: boolean;
}): number {
  if (typeof opts.geocodeConfidence === "number" && Number.isFinite(opts.geocodeConfidence)) {
    return Math.max(0, Math.min(1, opts.geocodeConfidence));
  }
  if (opts.locationSource === "ANI_ALI" || opts.locationSource === "RAPIDSOS") return 0.8;
  if (opts.locationSource === "GIS") return 0.75;
  if (opts.hasText) return 0.4;
  return 0.15;
}

export function jurisdictionHint(opts: {
  city?: string | null;
  state?: string | null;
  tenantCity?: string | null;
  tenantState?: string | null;
}): { match: boolean; label: string } {
  const city = opts.city?.trim().toLowerCase() ?? "";
  const state = opts.state?.trim().toLowerCase() ?? "";
  const tCity = opts.tenantCity?.trim().toLowerCase() ?? "";
  const tState = opts.tenantState?.trim().toLowerCase() ?? "";
  if (!city && !state) return { match: false, label: "Unverified jurisdiction" };
  if (tCity && city && city.includes(tCity)) return { match: true, label: opts.city?.trim() || city };
  if (tState && state && (state === tState || state.includes(tState))) {
    return { match: true, label: [opts.city, opts.state].filter(Boolean).join(", ") };
  }
  if (!tCity && !tState && (city || state)) {
    return { match: true, label: [opts.city, opts.state].filter(Boolean).join(", ") };
  }
  return { match: false, label: [opts.city, opts.state].filter(Boolean).join(", ") || "Outside mapped jurisdiction" };
}
