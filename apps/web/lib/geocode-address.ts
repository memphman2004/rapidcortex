/**
 * Mapbox forward geocode for incident addresses.
 * Uses the public Mapbox token already baked into the web app.
 */

export type GeocodeResult = {
  lat: number;
  lng: number;
  placeName: string;
};

export async function geocodeAddress(
  address: string,
  mapboxToken: string,
  opts?: { types?: string },
): Promise<GeocodeResult | null> {
  const query = address.trim();
  const token = mapboxToken.trim();
  if (!query || !token) return null;

  const types = opts?.types ?? "address,place,poi";
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&types=${encodeURIComponent(types)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: { center?: [number, number]; place_name?: string }[];
  };
  const feature = data.features?.[0];
  if (!feature?.center || feature.center.length < 2) return null;
  const [lng, lat] = feature.center;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    placeName: feature.place_name?.trim() || query,
  };
}
