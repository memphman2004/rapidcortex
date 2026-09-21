import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import { LocationClient } from "@aws-sdk/client-location";
import { env } from "../lib/env.js";

let cached: LocationClient | null = null;
let cachedPlaces: GeoPlacesClient | null = null;

export function alsLocationMockEnabled(): boolean {
  return env.alsLocationMock;
}

export function getLocationClient(): LocationClient {
  if (!cached) {
    cached = new LocationClient({ region: env.region || "us-east-1" });
  }
  return cached;
}

export function getGeoPlacesClient(): GeoPlacesClient {
  if (!cachedPlaces) {
    cachedPlaces = new GeoPlacesClient({ region: env.region || "us-east-1" });
  }
  return cachedPlaces;
}
