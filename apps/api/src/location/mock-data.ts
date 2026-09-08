import type { AlsGeocodeResult, AlsRouteResult } from "rapid-cortex-shared";

const WHITE_HOUSE: AlsGeocodeResult = {
  latitude: 38.8977,
  longitude: -77.0365,
  formattedAddress: "1600 Pennsylvania Avenue NW, Washington, DC, USA",
  street: "1600 Pennsylvania Avenue NW",
  city: "Washington",
  state: "District of Columbia",
  country: "USA",
  postalCode: "20500",
  confidence: 0.99,
  provider: "amazon-location",
};

const LOCUST_KC: AlsGeocodeResult = {
  latitude: 39.1012,
  longitude: -94.583,
  formattedAddress: "1125 Locust Street, Kansas City, MO, USA",
  street: "1125 Locust Street",
  city: "Kansas City",
  state: "Missouri",
  country: "USA",
  postalCode: "64106",
  confidence: 0.95,
  provider: "amazon-location",
};

const ATLANTA: AlsGeocodeResult = {
  latitude: 33.749,
  longitude: -84.388,
  formattedAddress: "Atlanta, GA, USA",
  city: "Atlanta",
  state: "Georgia",
  country: "USA",
  confidence: 0.5,
  provider: "amazon-location",
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function mockGeocodeAddress(address: string): AlsGeocodeResult[] {
  const n = normalize(address);
  if (n.includes("1600") && n.includes("pennsylvania")) return [WHITE_HOUSE];
  if (n.includes("1125") && n.includes("locust")) return [LOCUST_KC];
  if (n.includes("kansas city")) return [LOCUST_KC];
  return [{ ...ATLANTA, formattedAddress: address.trim() || ATLANTA.formattedAddress }];
}

export function mockReverseGeocode(longitude: number, latitude: number): AlsGeocodeResult[] {
  return [
    {
      ...ATLANTA,
      latitude,
      longitude,
      formattedAddress: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      confidence: 0.6,
    },
  ];
}

export function mockCalculateRoute(
  origin: [number, number],
  destination: [number, number],
): AlsRouteResult {
  const [olng, olat] = origin;
  const [dlng, dlat] = destination;
  const dLat = dlat - olat;
  const dLng = dlng - olng;
  const miles = Math.max(0.1, Math.sqrt(dLat * dLat + dLng * dLng) * 69);
  return {
    distanceMiles: Math.round(miles * 10) / 10,
    durationMinutes: Math.max(1, Math.ceil(miles * 2.2)),
    geometry: [origin, destination],
    provider: "amazon-location",
  };
}
