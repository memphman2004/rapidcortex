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

export type MockHospitalPlace = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  address?: string;
  phone?: string;
  categories?: string[];
};

const MOCK_HOSPITALS: MockHospitalPlace[] = [
  {
    id: "mock-grady",
    name: "Grady Memorial Hospital",
    longitude: -84.382,
    latitude: 33.752,
    address: "80 Jesse Hill Jr Dr SE, Atlanta, GA",
    phone: "(404) 616-1000",
    categories: ["hospital", "hospital_emergency_room"],
  },
  {
    id: "mock-emory",
    name: "Emory University Hospital",
    longitude: -84.322,
    latitude: 33.793,
    address: "1364 Clifton Rd NE, Atlanta, GA",
    phone: "(404) 712-2000",
    categories: ["hospital", "hospital_emergency_room"],
  },
  {
    id: "mock-piedmont-atl",
    name: "Piedmont Atlanta Hospital",
    longitude: -84.393,
    latitude: 33.808,
    address: "1968 Peachtree Rd NW, Atlanta, GA",
    phone: "(404) 605-5000",
    categories: ["hospital", "hospital_emergency_room"],
  },
  {
    id: "mock-choa",
    name: "Children's Healthcare of Atlanta Egleston",
    longitude: -84.335,
    latitude: 33.794,
    address: "1405 Clifton Rd NE, Atlanta, GA",
    phone: "(404) 785-6000",
    categories: ["hospital", "hospital_emergency_room"],
  },
  {
    id: "mock-piedmont-columbus",
    name: "Piedmont Columbus Regional",
    longitude: -84.987,
    latitude: 32.469,
    address: "710 Center St, Columbus, GA",
    phone: "(706) 571-1000",
    categories: ["hospital", "hospital_emergency_room"],
  },
];

function milesBetween(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 69;
}

export function mockNearbyHospitals(lng: number, lat: number, radiusMeters: number): MockHospitalPlace[] {
  const radiusMiles = radiusMeters / 1609.34;
  return MOCK_HOSPITALS.filter(
    (place) => milesBetween(lng, lat, place.longitude, place.latitude) <= radiusMiles + 0.5,
  );
}

export type MockEducationPlace = {
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
};

const MOCK_EDUCATION: MockEducationPlace[] = [
  {
    id: "mock-csu",
    name: "Columbus State University",
    longitude: -84.9405,
    latitude: 32.5022,
    address: "4225 University Ave, Columbus, GA",
    city: "Columbus",
    state: "GA",
    phone: "(706) 507-8800",
    website: "https://www.columbusstate.edu",
    categories: ["higher_education"],
  },
  {
    id: "mock-northside-hs",
    name: "Northside High School",
    longitude: -84.958,
    latitude: 32.522,
    address: "2002 American Way, Columbus, GA",
    city: "Columbus",
    state: "GA",
    categories: ["secondary_school", "school"],
  },
  {
    id: "mock-downtown-es",
    name: "Downtown Elementary Magnet Academy",
    longitude: -84.987,
    latitude: 32.465,
    address: "1112 29th St, Columbus, GA",
    city: "Columbus",
    state: "GA",
    categories: ["primary_school", "school"],
  },
  {
    id: "mock-midland-school",
    name: "Midland Middle School",
    longitude: -84.86,
    latitude: 32.57,
    address: "7040 Flat Rock Rd, Midland, GA",
    city: "Midland",
    state: "GA",
    categories: ["school"],
  },
  {
    id: "mock-emory",
    name: "Emory University",
    longitude: -84.323,
    latitude: 33.792,
    address: "201 Dowman Dr, Atlanta, GA",
    city: "Atlanta",
    state: "GA",
    categories: ["higher_education"],
  },
];

export function mockNearbyEducation(lng: number, lat: number, radiusMeters: number): MockEducationPlace[] {
  const radiusMiles = radiusMeters / 1609.34;
  return MOCK_EDUCATION.filter(
    (place) => milesBetween(lng, lat, place.longitude, place.latitude) <= radiusMiles + 0.5,
  );
}
