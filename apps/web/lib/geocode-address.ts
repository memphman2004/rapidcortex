/**
 * Browser geocode via authenticated Lambda. ALS credentials never leave the API.
 * The unused second argument is kept so older callers still compile.
 */

export type GeocodeResult = {
  lat: number;
  lng: number;
  placeName: string;
};

export async function geocodeAddress(
  address: string,
  _unusedToken?: string,
  _opts?: { types?: string },
): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  const qs = new URLSearchParams({ address: query });
  const res = await fetch(`/api/location/geocode?${qs.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    results?: Array<{ latitude?: number; longitude?: number; formattedAddress?: string }>;
  };
  const first = data.results?.[0];
  if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) return null;
  return {
    lat: first.latitude!,
    lng: first.longitude!,
    placeName: first.formattedAddress?.trim() || query,
  };
}
