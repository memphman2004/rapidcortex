import { describe, expect, it } from "vitest";
import {
  transitAlertLevelSchema,
  transitIncidentCreateBodySchema,
  transitVehicleGpsBodySchema,
  transitVehicleUpsertBodySchema,
} from "./schemas.js";

describe("transit schemas", () => {
  it("accepts a vehicle upsert with GPS", () => {
    const parsed = transitVehicleUpsertBodySchema.parse({
      vehicleId: "bus-14",
      label: "Bus 14",
      mode: "bus",
      status: "in_service",
      lastLat: 33.4,
      lastLng: -86.8,
    });
    expect(parsed.vehicleId).toBe("bus-14");
  });

  it("rejects invalid GPS latitude", () => {
    expect(() =>
      transitVehicleGpsBodySchema.parse({ lat: 99, lng: -86.8 }),
    ).toThrow();
  });

  it("requires incident summary", () => {
    expect(() =>
      transitIncidentCreateBodySchema.parse({ type: "medical", summary: "" }),
    ).toThrow();
  });

  it("parses alert levels", () => {
    expect(transitAlertLevelSchema.parse("emergency_stop")).toBe("emergency_stop");
  });
});
