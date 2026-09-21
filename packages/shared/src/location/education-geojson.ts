import { EDUCATION_POI_CATEGORIES } from "./schemas.js";
import { formatHospitalDistance, haversineMiles } from "./hospital-geojson.js";

export type EducationType = (typeof EDUCATION_POI_CATEGORIES)[number];

export const EDUCATION_TYPE_LABELS: Record<EducationType, string> = {
  higher_education: "Higher Education",
  secondary_school: "Secondary School",
  primary_school: "Primary School",
  school: "School",
};

const EDUCATION_TYPE_PRIORITY: EducationType[] = [
  "higher_education",
  "secondary_school",
  "primary_school",
  "school",
];

export type EducationGeoJsonProperties = {
  id: string;
  name: string;
  educationType: EducationType;
  educationLabel: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  website: string;
  distanceMeters: number | null;
  distance: string;
};

export type EducationMapFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: EducationGeoJsonProperties;
};

export type EducationMapFeatureCollection = {
  type: "FeatureCollection";
  features: EducationMapFeature[];
};

export type EducationPlaceInput = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  website?: string;
  categories?: string[];
  distanceMeters?: number;
};

function normalizeCategoryToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function educationTypeLabel(type: EducationType): string {
  return EDUCATION_TYPE_LABELS[type];
}

export function pickEducationType(categories: string[]): EducationType {
  const normalized = categories.map(normalizeCategoryToken);
  for (const type of EDUCATION_TYPE_PRIORITY) {
    if (normalized.includes(type)) return type;
  }
  if (normalized.some((token) => token.includes("higher_education") || token.includes("university") || token.includes("college"))) {
    return "higher_education";
  }
  if (normalized.some((token) => token.includes("secondary") || token.includes("high_school"))) {
    return "secondary_school";
  }
  if (normalized.some((token) => token.includes("primary") || token.includes("elementary"))) {
    return "primary_school";
  }
  return "school";
}

export function educationDedupeKey(place: {
  id?: string;
  name: string;
  longitude: number;
  latitude: number;
}): string {
  const id = place.id?.trim();
  if (id) return `id:${id}`;
  const title = place.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `geo:${title}|${place.longitude.toFixed(5)}|${place.latitude.toFixed(5)}`;
}

export function dedupeEducationPlaces(places: EducationPlaceInput[]): EducationPlaceInput[] {
  const seen = new Set<string>();
  const out: EducationPlaceInput[] = [];
  for (const place of places) {
    const key = educationDedupeKey(place);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
}

export function formatEducationDistance(meters: number): string {
  return formatHospitalDistance(meters / 1609.34);
}

export function educationToGeoJSON(
  places: EducationPlaceInput[],
  origin: { lng: number; lat: number },
): EducationMapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: dedupeEducationPlaces(places)
      .filter(
        (place) =>
          Number.isFinite(place.latitude) &&
          Number.isFinite(place.longitude) &&
          Math.abs(place.latitude) <= 90 &&
          Math.abs(place.longitude) <= 180,
      )
      .map((place) => {
        const haversine = haversineMiles(origin.lng, origin.lat, place.longitude, place.latitude);
        const distanceMeters =
          typeof place.distanceMeters === "number" && Number.isFinite(place.distanceMeters)
            ? Math.max(0, Math.round(place.distanceMeters))
            : Math.round(haversine * 1609.34);
        const educationType = pickEducationType(place.categories ?? []);
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [place.longitude, place.latitude] as [number, number],
          },
          properties: {
            id: place.id.trim() || educationDedupeKey(place),
            name: place.name.trim() || "School",
            educationType,
            educationLabel: educationTypeLabel(educationType),
            address: (place.address ?? "").trim(),
            city: (place.city ?? "").trim(),
            state: (place.state ?? "").trim(),
            phone: (place.phone ?? "").trim(),
            website: (place.website ?? "").trim(),
            distanceMeters,
            distance: formatEducationDistance(distanceMeters),
          },
        };
      }),
  };
}

export function isEducationMapFeatureCollection(
  value: unknown,
): value is EducationMapFeatureCollection {
  if (!value || typeof value !== "object") return false;
  const rec = value as { type?: unknown; features?: unknown };
  return rec.type === "FeatureCollection" && Array.isArray(rec.features);
}
