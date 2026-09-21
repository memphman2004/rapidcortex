import type { SearchNearbyCommandInput, SearchNearbyCommandOutput } from "@aws-sdk/client-geo-places";
import { SearchNearbyCommand } from "@aws-sdk/client-geo-places";
import {
  EDUCATION_POI_CATEGORIES,
  educationToGeoJSON,
  type AlsEducationSearchQuery,
  type EducationMapFeatureCollection,
  type EducationPlaceInput,
} from "rapid-cortex-shared";
import { alsLocationMockEnabled, getGeoPlacesClient } from "./client.js";
import { mockNearbyEducation } from "./mock-data.js";

export const EDUCATION_SEARCH_PAGE_SIZE = 100;
export const EDUCATION_SEARCH_MAX_PAGES = 3;
export const EDUCATION_SEARCH_MAX_RESULTS = 300;

export class EducationPlacesUnavailableError extends Error {
  constructor() {
    super("Schools / Campuses are temporarily unavailable.");
    this.name = "EducationPlacesUnavailableError";
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function regionCode(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const rec = value as { Code?: unknown; Name?: unknown };
  return text(rec.Code) || text(rec.Name);
}

export function educationSearchOrigin(query: AlsEducationSearchQuery): { lng: number; lat: number } {
  if (query.fromLng != null && query.fromLat != null) {
    return { lng: query.fromLng, lat: query.fromLat };
  }
  return { lng: query.centerLng, lat: query.centerLat };
}

export function educationQueryRadiusMeters(query: AlsEducationSearchQuery): number {
  if (query.radiusMeters != null) return query.radiusMeters;
  if (
    query.west != null &&
    query.south != null &&
    query.east != null &&
    query.north != null
  ) {
    const dLat = query.north - query.south;
    const dLng = query.east - query.west;
    const miles = Math.sqrt(dLat * dLat + dLng * dLng) * 69;
    return Math.min(50_000, Math.max(5_000, Math.round((miles / 2) * 1609.34)));
  }
  return 30_000;
}

function placesFromSearch(output: SearchNearbyCommandOutput): EducationPlaceInput[] {
  const items = output.ResultItems ?? [];
  const out: EducationPlaceInput[] = [];
  for (const item of items) {
    const position = item.Position;
    const lng = position?.[0];
    const lat = position?.[1];
    if (typeof lng !== "number" || typeof lat !== "number") continue;
    const categories = (item.Categories ?? [])
      .flatMap((category) => [category.Id, category.Name, category.LocalizedName])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    const phone = item.Contacts?.Phones?.[0]?.Value;
    const website = item.Contacts?.Websites?.[0]?.Value;
    const distanceMeters = typeof item.Distance === "number" && Number.isFinite(item.Distance) ? item.Distance : undefined;
    out.push({
      id: text(item.PlaceId) || `${lng.toFixed(5)},${lat.toFixed(5)}`,
      name: text(item.Title) || "School",
      longitude: lng,
      latitude: lat,
      address: text(item.Address?.Label),
      city: text(item.Address?.Locality),
      state: regionCode(item.Address?.Region),
      phone: text(phone),
      website: text(website),
      categories,
      distanceMeters,
    });
  }
  return out;
}

function searchInput(
  query: AlsEducationSearchQuery,
  nextToken: string | undefined,
): SearchNearbyCommandInput {
  const filter: NonNullable<SearchNearbyCommandInput["Filter"]> = {
    IncludeCategories: [...EDUCATION_POI_CATEGORIES],
  };
  if (
    query.west != null &&
    query.south != null &&
    query.east != null &&
    query.north != null
  ) {
    filter.BoundingBox = [query.west, query.south, query.east, query.north];
  }
  return {
    QueryPosition: [query.centerLng, query.centerLat],
    QueryRadius: educationQueryRadiusMeters(query),
    MaxResults: EDUCATION_SEARCH_PAGE_SIZE,
    Filter: filter,
    AdditionalFeatures: ["Contact"],
    IntendedUse: "SingleUse",
    Language: "en",
    NextToken: nextToken,
  };
}

export async function searchNearbyEducation(
  query: AlsEducationSearchQuery,
): Promise<EducationMapFeatureCollection> {
  const origin = educationSearchOrigin(query);
  const radius = educationQueryRadiusMeters(query);

  if (alsLocationMockEnabled()) {
    return educationToGeoJSON(mockNearbyEducation(query.centerLng, query.centerLat, radius), origin);
  }

  try {
    const client = getGeoPlacesClient();
    const collected: EducationPlaceInput[] = [];
    let nextToken: string | undefined;
    for (let page = 0; page < EDUCATION_SEARCH_MAX_PAGES; page += 1) {
      const resp = await client.send(new SearchNearbyCommand(searchInput(query, nextToken)));
      collected.push(...placesFromSearch(resp));
      if (collected.length >= EDUCATION_SEARCH_MAX_RESULTS) break;
      nextToken = resp.NextToken;
      if (!nextToken) break;
    }
    return educationToGeoJSON(collected.slice(0, EDUCATION_SEARCH_MAX_RESULTS), origin);
  } catch (err) {
    if (err instanceof EducationPlacesUnavailableError) throw err;
    throw new EducationPlacesUnavailableError();
  }
}
