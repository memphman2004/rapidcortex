import { describe, expect, it } from "vitest";
import {
  categoryIsEmergencyRoom,
  filterHospitalFeatures,
  formatHospitalDistance,
  haversineMiles,
  hospitalsToGeoJSON,
  isHospitalMapFeatureCollection,
} from "./hospital-geojson.js";

describe("hospital GeoJSON overlay", () => {
  it("emits [longitude, latitude] with ER flag and distance", () => {
    const fc = hospitalsToGeoJSON(
      [
        {
          id: "place-1",
          name: "Piedmont Columbus Regional",
          longitude: -84.987,
          latitude: 32.469,
          address: "710 Center St, Columbus, GA",
          phone: "(706) 571-1000",
          categories: ["hospital", "hospital_emergency_room"],
        },
      ],
      { lng: -84.99, lat: 32.46 },
    );
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry.coordinates).toEqual([-84.987, 32.469]);
    expect(fc.features[0]?.properties.emergencyRoom).toBe(true);
    expect(fc.features[0]?.properties.category).toBe("hospital_emergency_room");
    expect(fc.features[0]?.properties.distance).toMatch(/mi/);
    expect(fc.features[0]?.properties.phone).toBe("(706) 571-1000");
  });

  it("filters ER-only without dropping hospitals when both layers are on", () => {
    const fc = hospitalsToGeoJSON(
      [
        {
          id: "er",
          name: "ER",
          longitude: -84.4,
          latitude: 33.75,
          categories: ["hospital_emergency_room"],
        },
        {
          id: "clinic",
          name: "Clinic",
          longitude: -84.41,
          latitude: 33.76,
          categories: ["hospital_or_health_care_facility"],
        },
      ],
      { lng: -84.4, lat: 33.75 },
    );
    expect(filterHospitalFeatures(fc, { hospitals: true, emergencyRooms: true }).features).toHaveLength(2);
    expect(filterHospitalFeatures(fc, { hospitals: false, emergencyRooms: true }).features).toHaveLength(1);
    expect(filterHospitalFeatures(fc, { hospitals: false, emergencyRooms: false }).features).toHaveLength(0);
  });

  it("formats short distances and classifies ER categories", () => {
    expect(formatHospitalDistance(0.04)).toBe("<0.1 mi");
    expect(formatHospitalDistance(2.41)).toBe("2.4 mi");
    expect(categoryIsEmergencyRoom(["Hospital Emergency Room"])).toBe(true);
    expect(categoryIsEmergencyRoom(["hospital"])).toBe(false);
    expect(haversineMiles(-84.39, 33.75, -84.39, 33.75)).toBe(0);
    expect(isHospitalMapFeatureCollection({ type: "FeatureCollection", features: [] })).toBe(true);
    expect(isHospitalMapFeatureCollection({ hospitals: [] })).toBe(false);
  });
});
