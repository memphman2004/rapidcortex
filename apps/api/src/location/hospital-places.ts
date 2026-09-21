import type { SearchNearbyCommandOutput } from "@aws-sdk/client-geo-places";
import { SearchNearbyCommand } from "@aws-sdk/client-geo-places";
import {
  HOSPITAL_POI_CATEGORIES,
  hospitalsToGeoJSON,
  type AlsHospitalMapFeatureCollection,
  type AlsHospitalPlaceInput,
  type AlsHospitalSearchQuery,
} from "rapid-cortex-shared";
import { alsLocationMockEnabled, getGeoPlacesClient } from "./client.js";
import { mockNearbyHospitals } from "./mock-data.js";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function placesFromSearch(output: SearchNearbyCommandOutput): AlsHospitalPlaceInput[] {
  const items = output.ResultItems ?? [];
  const out: AlsHospitalPlaceInput[] = [];
  for (const item of items) {
    const position = item.Position;
    const lng = position?.[0];
    const lat = position?.[1];
    if (typeof lng !== "number" || typeof lat !== "number") continue;
    const categories = (item.Categories ?? [])
      .flatMap((category) => [category.Id, category.Name, category.LocalizedName])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    const phone = item.Contacts?.Phones?.[0]?.Value;
    out.push({
      id: text(item.PlaceId) || `${lng.toFixed(5)},${lat.toFixed(5)}`,
      name: text(item.Title) || "Hospital",
      longitude: lng,
      latitude: lat,
      address: text(item.Address?.Label),
      phone: text(phone),
      categories,
    });
  }
  return out;
}

export function hospitalSearchOrigin(query: AlsHospitalSearchQuery): { lng: number; lat: number } {
  if (query.fromLng != null && query.fromLat != null) {
    return { lng: query.fromLng, lat: query.fromLat };
  }
  return { lng: query.lng, lat: query.lat };
}

export async function searchNearbyHospitals(
  query: AlsHospitalSearchQuery,
): Promise<AlsHospitalMapFeatureCollection> {
  const origin = hospitalSearchOrigin(query);
  const categories = query.erOnly
    ? (["hospital_emergency_room"] as const)
    : HOSPITAL_POI_CATEGORIES;

  if (alsLocationMockEnabled()) {
    const mocked = mockNearbyHospitals(query.lng, query.lat, query.radius ?? 30_000);
    const filtered = query.erOnly
      ? mocked.filter((place) => (place.categories ?? []).some((value) => value.includes("emergency")))
      : mocked;
    return hospitalsToGeoJSON(filtered, origin);
  }

  try {
    const resp = await getGeoPlacesClient().send(
      new SearchNearbyCommand({
        QueryPosition: [query.lng, query.lat],
        QueryRadius: query.radius ?? 30_000,
        MaxResults: 100,
        Filter: { IncludeCategories: [...categories] },
        AdditionalFeatures: ["Contact"],
        IntendedUse: "SingleUse",
        Language: "en",
      }),
    );
    return hospitalsToGeoJSON(placesFromSearch(resp), origin);
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}
