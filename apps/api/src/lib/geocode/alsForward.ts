/**
 * Optional server-side ALS forward geocode for incident create/update.
 * Fail-open: returns null on any error so create/update can continue.
 */

import { geocodeAddress } from "../../location/geocoding.js";

export type AlsForwardGeocodeResult = {
  lat: number;
  lng: number;
  placeName: string;
};

export async function forwardGeocodeAddress(
  address: string,
): Promise<AlsForwardGeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const results = await geocodeAddress(trimmed, { maxResults: 1 });
    const first = results[0];
    if (!first) return null;
    if (!Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) return null;
    return {
      lat: first.latitude,
      lng: first.longitude,
      placeName: first.formattedAddress || trimmed,
    };
  } catch {
    return null;
  }
}
