/**
 * Optional server-side Mapbox forward geocode.
 * Token resolution: MAPBOX_ACCESS_TOKEN / NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN env.
 * Fail-open: returns null on any error so create/update can continue.
 */

export type MapboxGeocodeResult = {
  lat: number;
  lng: number;
  placeName: string;
};

function envToken(): string {
  return (
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
    ""
  );
}

/**
 * Forward-geocode a freeform address via Mapbox Geocoding API.
 * Returns null when token missing, network fails, or no features.
 */
export async function forwardGeocodeAddress(
  address: string,
): Promise<MapboxGeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const token = envToken();
  if (!token) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(trimmed)}.json?access_token=${encodeURIComponent(token)}` +
    `&limit=1&types=address,place,poi`;

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      features?: Array<{
        place_name?: string;
        center?: [number, number];
      }>;
    };
    const feature = body.features?.[0];
    const center = feature?.center;
    if (!center || center.length < 2) return null;
    const [lng, lat] = center;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    return {
      lat,
      lng,
      placeName: feature.place_name?.trim() || trimmed,
    };
  } catch {
    return null;
  }
}
