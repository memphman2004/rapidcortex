import { HOSPITAL_POI_CATEGORIES } from "./schemas.js";

export type HospitalPoiCategory = (typeof HOSPITAL_POI_CATEGORIES)[number];

export type AlsHospitalFeatureProperties = {
  id: string;
  name: string;
  category: string;
  emergencyRoom: boolean;
  address: string;
  phone: string;
  distance: string;
  distanceMiles: number;
};

export type AlsHospitalMapFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: AlsHospitalFeatureProperties;
};

export type AlsHospitalMapFeatureCollection = {
  type: "FeatureCollection";
  features: AlsHospitalMapFeature[];
};

export type AlsHospitalPlaceInput = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  address?: string;
  phone?: string;
  categories?: string[];
};

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatHospitalDistance(miles: number): string {
  if (!Number.isFinite(miles) || miles < 0) return "";
  if (miles < 0.1) return "<0.1 mi";
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function categoryIsEmergencyRoom(categories: string[]): boolean {
  return categories.some((value) => {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return (
      normalized === "hospital_emergency_room" ||
      normalized.includes("emergency_room") ||
      normalized.includes("emergency_department")
    );
  });
}

export function pickHospitalCategory(categories: string[]): string {
  const normalized = categories.map((value) => value.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  if (normalized.includes("hospital_emergency_room")) return "hospital_emergency_room";
  if (normalized.includes("hospital")) return "hospital";
  if (normalized.includes("hospital_or_health_care_facility")) {
    return "hospital_or_health_care_facility";
  }
  return normalized[0] || "hospital";
}

export function hospitalsToGeoJSON(
  places: AlsHospitalPlaceInput[],
  origin: { lng: number; lat: number },
): AlsHospitalMapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: places
      .filter(
        (place) =>
          Number.isFinite(place.latitude) &&
          Number.isFinite(place.longitude) &&
          Math.abs(place.latitude) <= 90 &&
          Math.abs(place.longitude) <= 180,
      )
      .map((place) => {
        const miles = haversineMiles(origin.lng, origin.lat, place.longitude, place.latitude);
        const categories = place.categories ?? [];
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [place.longitude, place.latitude] as [number, number],
          },
          properties: {
            id: place.id,
            name: place.name.trim() || "Hospital",
            category: pickHospitalCategory(categories),
            emergencyRoom: categoryIsEmergencyRoom(categories),
            address: (place.address ?? "").trim(),
            phone: (place.phone ?? "").trim(),
            distance: formatHospitalDistance(miles),
            distanceMiles: Math.round(miles * 10) / 10,
          },
        };
      }),
  };
}

export function isHospitalMapFeatureCollection(
  value: unknown,
): value is AlsHospitalMapFeatureCollection {
  if (!value || typeof value !== "object") return false;
  const rec = value as { type?: unknown; features?: unknown };
  return rec.type === "FeatureCollection" && Array.isArray(rec.features);
}

export function filterHospitalFeatures(
  collection: AlsHospitalMapFeatureCollection,
  opts: { hospitals: boolean; emergencyRooms: boolean },
): AlsHospitalMapFeatureCollection {
  if (!opts.hospitals && !opts.emergencyRooms) {
    return { type: "FeatureCollection", features: [] };
  }
  if (opts.hospitals && opts.emergencyRooms) return collection;
  if (opts.emergencyRooms) {
    return {
      type: "FeatureCollection",
      features: collection.features.filter((feature) => feature.properties.emergencyRoom),
    };
  }
  return collection;
}
