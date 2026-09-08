import {
  SearchPlaceIndexForPositionCommand,
  SearchPlaceIndexForTextCommand,
} from "@aws-sdk/client-location";
import type { AlsGeocodeResult } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { alsLocationMockEnabled, getLocationClient } from "./client.js";
import { mockGeocodeAddress, mockReverseGeocode } from "./mock-data.js";

export interface GeocodeOptions {
  biasLat?: number;
  biasLng?: number;
  filterCountries?: string[];
  maxResults?: number;
}

function placeToResult(
  place: {
    Label?: string;
    AddressNumber?: string;
    Street?: string;
    Municipality?: string;
    Region?: string;
    Country?: string;
    PostalCode?: string;
    Geometry?: { Point?: number[] };
  } | undefined,
  relevance: number | undefined,
  fallbackAddress: string,
  fallbackLat: number,
  fallbackLng: number,
): AlsGeocodeResult {
  const point = place?.Geometry?.Point;
  return {
    latitude: place?.Geometry?.Point?.[1] ?? fallbackLat,
    longitude: point?.[0] ?? fallbackLng,
    formattedAddress: place?.Label ?? fallbackAddress,
    street: [place?.AddressNumber, place?.Street].filter(Boolean).join(" ") || undefined,
    city: place?.Municipality,
    state: place?.Region,
    country: place?.Country,
    postalCode: place?.PostalCode,
    confidence: typeof relevance === "number" ? Math.min(1, Math.max(0, relevance)) : 0,
    provider: "amazon-location",
  };
}

export async function geocodeAddress(
  address: string,
  options: GeocodeOptions = {},
): Promise<AlsGeocodeResult[]> {
  const trimmed = address.trim();
  if (!trimmed) return [];
  if (alsLocationMockEnabled() || !env.alsPlaceIndexName) {
    return mockGeocodeAddress(trimmed);
  }
  try {
    const resp = await getLocationClient().send(
      new SearchPlaceIndexForTextCommand({
        IndexName: env.alsPlaceIndexName,
        Text: trimmed,
        BiasPosition:
          options.biasLat != null && options.biasLng != null
            ? [options.biasLng, options.biasLat]
            : undefined,
        FilterCountries: options.filterCountries ?? ["USA"],
        MaxResults: options.maxResults ?? 5,
      }),
    );
    return (resp.Results ?? []).map((result) =>
      placeToResult(result.Place, result.Relevance, trimmed, 0, 0),
    );
  } catch {
    return [];
  }
}

export async function reverseGeocode(
  longitude: number,
  latitude: number,
  maxResults = 1,
): Promise<AlsGeocodeResult[]> {
  if (alsLocationMockEnabled() || !env.alsPlaceIndexName) {
    return mockReverseGeocode(longitude, latitude);
  }
  try {
    const resp = await getLocationClient().send(
      new SearchPlaceIndexForPositionCommand({
        IndexName: env.alsPlaceIndexName,
        Position: [longitude, latitude],
        MaxResults: maxResults,
      }),
    );
    return (resp.Results ?? []).map((result) =>
      placeToResult(
        result.Place,
        result.Distance != null ? Math.max(0, 1 - result.Distance / 1000) : 1,
        `${latitude}, ${longitude}`,
        latitude,
        longitude,
      ),
    );
  } catch {
    return [];
  }
}
