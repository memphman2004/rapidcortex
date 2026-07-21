import { describe, expect, it } from "vitest";
import { haversineMeters, isUnitOnScene } from "./rcs-geofence.js";

describe("rcs-geofence haversineMeters", () => {
  it("returns ~0 for identical coordinates", () => {
    expect(haversineMeters(27.9506, -82.4572, 27.9506, -82.4572)).toBeCloseTo(0, 3);
  });

  it("returns a known distance between two Tampa-area points (~1.9km)", () => {
    // Downtown Tampa to Ybor City — roughly 1.8-2.0km apart.
    const meters = haversineMeters(27.9506, -82.4572, 27.9572, -82.4392);
    expect(meters).toBeGreaterThan(1700);
    expect(meters).toBeLessThan(2100);
  });

  it("is symmetric regardless of point order", () => {
    const a = haversineMeters(27.9506, -82.4572, 28.0, -82.5);
    const b = haversineMeters(28.0, -82.5, 27.9506, -82.4572);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("rcs-geofence isUnitOnScene", () => {
  const target = { lat: 27.9506, lon: -82.4572 };

  it("is true when the unit is within the default arrival radius", () => {
    // ~10m offset in latitude.
    expect(isUnitOnScene(27.95069, -82.4572, target.lat, target.lon)).toBe(true);
  });

  it("is false when the unit is well outside the default arrival radius", () => {
    expect(isUnitOnScene(28.05, -82.55, target.lat, target.lon)).toBe(false);
  });

  it("honors a custom per-call radius", () => {
    // ~300m away — outside a tight 50m geofence but inside a generous 500m one.
    expect(isUnitOnScene(27.953, -82.4572, target.lat, target.lon, 50)).toBe(false);
    expect(isUnitOnScene(27.953, -82.4572, target.lat, target.lon, 500)).toBe(true);
  });
});
