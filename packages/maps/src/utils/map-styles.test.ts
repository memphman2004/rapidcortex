import { afterEach, describe, expect, it } from "vitest";
import {
  alsMapStyleUrl,
  alsNamedMapStyleUrl,
  buildAlsMapV2StyleUrl,
  isAlsMapApiV2,
  shouldFallbackAlsV2ToNamedMap,
} from "./map-styles";

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
  it("defaults to V2 when unset", () => {
    delete process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION;
    expect(isAlsMapApiV2()).toBe(true);
  });

  it("is false only for explicit v1", () => {
    process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION = "v1";
    expect(isAlsMapApiV2()).toBe(false);
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
  it("uses named HERE maps only when API version is v1", () => {
    process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION = "v1";
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

  it("uses V2 descriptors by default", () => {
    delete process.env.NEXT_PUBLIC_ALS_MAP_API_VERSION;
    process.env.NEXT_PUBLIC_ALS_REGION = "us-east-1";
    expect(alsMapStyleUrl("dark", { traffic: "Congestion" })).toContain("/v2/styles/Standard/descriptor");
    expect(alsMapStyleUrl("dark", { traffic: "Congestion" })).toContain("color-scheme=Dark");
    expect(alsMapStyleUrl("dark", { traffic: "Congestion" })).toContain("traffic=Congestion");
  });
});

describe("alsNamedMapStyleUrl", () => {
  it("defaults to HERE-named maps", () => {
    process.env.NEXT_PUBLIC_ALS_REGION = "us-east-1";
    expect(alsNamedMapStyleUrl("light")).toContain("/maps/v0/maps/rc-map-here-dev/style-descriptor");
    expect(alsNamedMapStyleUrl("dark")).toContain("/maps/v0/maps/rc-map-here-dark-dev/style-descriptor");
  });
});

describe("shouldFallbackAlsV2ToNamedMap", () => {
  const v2 = "https://maps.geo.us-east-1.amazonaws.com/v2/styles/Standard/descriptor?color-scheme=Dark";
  const v1 = "https://maps.geo.us-east-1.amazonaws.com/maps/v0/maps/rc-map-here-dev/style-descriptor";

  it("falls back on V2 403", () => {
    expect(shouldFallbackAlsV2ToNamedMap({ error: { status: 403, message: "AccessDenied" } }, v2)).toBe(true);
  });

  it("does not fall back on V1 styles or unrelated errors", () => {
    expect(shouldFallbackAlsV2ToNamedMap({ error: { status: 403 } }, v1)).toBe(false);
    expect(shouldFallbackAlsV2ToNamedMap({ error: { message: "Source overlay failed" } }, v2)).toBe(false);
  });
});
