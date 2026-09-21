import { afterEach, describe, expect, it } from "vitest";
import { alsMapStyleUrl, buildAlsMapV2StyleUrl, isAlsMapApiV2 } from "./map-styles";

const ENV_KEYS = [
  "NEXT_PUBLIC_ALS_MAP_API_VERSION",
  "NEXT_PUBLIC_ALS_MAP_STYLE",
  "NEXT_PUBLIC_ALS_REGION",
  "NEXT_PUBLIC_ALS_MAP_NAME",
  "NEXT_PUBLIC_ALS_MAP_NAME_DARK",
] as const;

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("isAlsMapApiV2", () => {
  it("is false when unset (V1 HERE rollback)", () => {
    delete process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION;
    expect(isAlsMapApiV2()).toBe(false);
  });

  it("is true only for v2", () => {
    process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION = "v2";
    expect(isAlsMapApiV2()).toBe(true);
  });
});

describe("buildAlsMapV2StyleUrl", () => {
  it("builds Standard Light/Dark descriptors", () => {
    process.env.NEXT_PUBLIC_ALS_REGION = "us-east-1";
    expect(buildAlsMapV2StyleUrl({ dark: false })).toBe(
      "https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?color-scheme=Light",
    );
    expect(buildAlsMapV2StyleUrl({ dark: true, traffic: true, buildings: true })).toBe(
      "https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?color-scheme=Dark&traffic=All&buildings=Buildings3D",
    );
  });

  it("restores live traffic as All when the overlay toggle is on", () => {
    expect(buildAlsMapV2StyleUrl({ dark: true, traffic: true })).toContain("traffic=All");
  });
});

describe("alsMapStyleUrl", () => {
  it("uses named HERE maps when API version is not v2", () => {
    process.env.NEXT_PUBLIC_ALS_REGION = "us-east-1";
    process.env.NEXT_PUBLIC_ALS_MAP_NAME = "rc-map-here-dev";
    process.env.NEXT_PUBLIC_ALS_MAP_NAME_DARK = "rc-map-here-dark-dev";
    expect(alsMapStyleUrl("light")).toBe(
      "https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/rc-map-here-dev/style-descriptor",
    );
    expect(alsMapStyleUrl("dark")).toBe(
      "https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/rc-map-here-dark-dev/style-descriptor",
    );
  });

  it("uses V2 descriptors when API version is v2", () => {
    process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION = "v2";
    process.env.NEXT_PUBLIC_ALS_REGION = "us-east-1";
    expect(alsMapStyleUrl("dark", { traffic: "Congestion" })).toContain("/v2/styles/Standard/descriptor");
    expect(alsMapStyleUrl("dark", { traffic: "Congestion" })).toContain("color-scheme=Dark");
    expect(alsMapStyleUrl("dark", { traffic: "Congestion" })).toContain("traffic=Congestion");
  });
});
