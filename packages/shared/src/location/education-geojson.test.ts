import { describe, expect, it } from "vitest";
import { alsEducationSearchQuerySchema } from "./schemas.js";
import {
  dedupeEducationPlaces,
  educationToGeoJSON,
  educationTypeLabel,
  formatEducationDistance,
  isEducationMapFeatureCollection,
  pickEducationType,
} from "./education-geojson.js";

describe("education category mapping", () => {
  it("prefers the most specific education category", () => {
    expect(pickEducationType(["school", "higher_education"])).toBe("higher_education");
    expect(pickEducationType(["primary_school", "school"])).toBe("primary_school");
    expect(pickEducationType(["Secondary School"])).toBe("secondary_school");
    expect(pickEducationType(["school"])).toBe("school");
  });

  it("maps categories to public-safety labels", () => {
    expect(educationTypeLabel("higher_education")).toBe("Higher Education");
    expect(educationTypeLabel("secondary_school")).toBe("Secondary School");
    expect(educationTypeLabel("primary_school")).toBe("Primary School");
    expect(educationTypeLabel("school")).toBe("School");
  });
});

describe("education GeoJSON overlay", () => {
  it("emits valid GeoJSON with [longitude, latitude] and distance", () => {
    const fc = educationToGeoJSON(
      [
        {
          id: "place-csu",
          name: "Columbus State University",
          longitude: -84.9405,
          latitude: 32.5022,
          address: "4225 University Ave, Columbus, GA",
          city: "Columbus",
          state: "GA",
          categories: ["higher_education"],
          distanceMeters: 1850,
        },
      ],
      { lng: -84.98, lat: 32.46 },
    );
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry.coordinates).toEqual([-84.9405, 32.5022]);
    expect(fc.features[0]?.properties.educationType).toBe("higher_education");
    expect(fc.features[0]?.properties.educationLabel).toBe("Higher Education");
    expect(fc.features[0]?.properties.distanceMeters).toBe(1850);
    expect(fc.features[0]?.properties.distance).toMatch(/mi/);
  });

  it("removes duplicate PlaceIds and falls back to title+coordinates", () => {
    const fc = educationToGeoJSON(
      [
        {
          id: "same",
          name: "Northside High School",
          longitude: -84.94,
          latitude: 32.51,
          categories: ["secondary_school"],
        },
        {
          id: "same",
          name: "Northside High School duplicate",
          longitude: -84.95,
          latitude: 32.52,
          categories: ["secondary_school"],
        },
        {
          id: "",
          name: "Downtown Elementary",
          longitude: -84.93,
          latitude: 32.48,
          categories: ["primary_school"],
        },
        {
          id: "  ",
          name: "Downtown Elementary",
          longitude: -84.93,
          latitude: 32.48,
          categories: ["primary_school"],
        },
      ],
      { lng: -84.98, lat: 32.46 },
    );
    expect(fc.features).toHaveLength(2);
    expect(fc.features.map((feature) => feature.properties.name)).toEqual([
      "Northside High School",
      "Downtown Elementary",
    ]);
  });

  it("formats short distances and rejects non-collections", () => {
    expect(formatEducationDistance(80)).toBe("<0.1 mi");
    expect(formatEducationDistance(2897)).toBe("1.8 mi");
    expect(isEducationMapFeatureCollection({ type: "FeatureCollection", features: [] })).toBe(true);
    expect(isEducationMapFeatureCollection({ schools: [] })).toBe(false);
    expect(dedupeEducationPlaces([])).toEqual([]);
  });
});

describe("education search query validation", () => {
  it("rejects invalid coordinates", () => {
    expect(
      alsEducationSearchQuerySchema.safeParse({ centerLat: 91, centerLng: -84.98 }).success,
    ).toBe(false);
    expect(
      alsEducationSearchQuerySchema.safeParse({ centerLat: 32.46, centerLng: 181 }).success,
    ).toBe(false);
    expect(
      alsEducationSearchQuerySchema.safeParse({ centerLat: 32.46, centerLng: -84.98 }).success,
    ).toBe(true);
  });

  it("requires a complete bounding box when any bound is present", () => {
    expect(
      alsEducationSearchQuerySchema.safeParse({
        centerLat: 32.46,
        centerLng: -84.98,
        west: -85.1,
      }).success,
    ).toBe(false);
    expect(
      alsEducationSearchQuerySchema.safeParse({
        centerLat: 32.46,
        centerLng: -84.98,
        west: -85.1,
        south: 32.3,
        east: -84.8,
        north: 32.6,
      }).success,
    ).toBe(true);
    expect(
      alsEducationSearchQuerySchema.safeParse({
        centerLat: 32.46,
        centerLng: -84.98,
        west: -84.8,
        south: 32.3,
        east: -85.1,
        north: 32.6,
      }).success,
    ).toBe(false);
  });
});
