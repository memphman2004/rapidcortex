import type { MapTheme } from "../types/map-types";

export type AlsMapV2StyleName = "Standard" | "Monochrome" | "Hybrid" | "Satellite";
export type AlsMapV2Traffic = "All" | "Congestion";
export type AlsMapV2Terrain = "Hillshade" | "Terrain3D";
export type AlsMapV2TravelMode = "Transit" | "Truck";

export type AlsMapV2StyleOptions = {
  dark?: boolean;
  traffic?: boolean | AlsMapV2Traffic;
  terrain?: boolean | AlsMapV2Terrain;
  buildings?: boolean;
  contours?: boolean;
  travelMode?: AlsMapV2TravelMode;
  style?: AlsMapV2StyleName;
};

function alsRegion(): string {
  return (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_REGION?.trim()) || "us-east-1";
}

/** Maps V2 when baked as `v2`; unset/anything else keeps named V1 maps (HERE rollback). */
export function isAlsMapApiV2(): boolean {
  const version =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_ALS_MAP_API_VERSION?.trim().toLowerCase() : "";
  return version === "v2";
}

export function alsMapV2StyleName(): AlsMapV2StyleName {
  const raw = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_MAP_STYLE?.trim()) || "Standard";
  if (raw === "Monochrome" || raw === "Hybrid" || raw === "Satellite") return raw;
  return "Standard";
}

/** Amazon Location Maps V2 style descriptor (no named map resource). */
export function buildAlsMapV2StyleUrl(options: AlsMapV2StyleOptions = {}): string {
  const style = options.style ?? alsMapV2StyleName();
  const url = new URL(`https://maps.geo.${alsRegion()}.amazonaws.com/v2/styles/${style}/descriptor`);
  url.searchParams.set("color-scheme", options.dark ? "Dark" : "Light");
  if (options.traffic) {
    url.searchParams.set("traffic", options.traffic === true ? "All" : options.traffic);
  }
  if (options.terrain) {
    url.searchParams.set("terrain", options.terrain === true ? "Hillshade" : options.terrain);
  }
  if (options.buildings) {
    url.searchParams.set("buildings", "Buildings3D");
  }
  if (options.contours) {
    url.searchParams.set("contour-density", "Medium");
  }
  if (options.travelMode) {
    url.searchParams.set("travel-modes", options.travelMode);
  }
  return url.toString();
}

function alsNamedMapStyleUrl(kind: "dark" | "standard"): string {
  const name =
    kind === "dark"
      ? (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_MAP_NAME_DARK?.trim()) ||
        "rc-map-dark-dev"
      : (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_MAP_NAME?.trim()) || "rc-map-dev";
  return `https://maps.geo.${alsRegion()}.amazonaws.com/maps/v0/maps/${name}/style-descriptor`;
}

/**
 * Style URL for MapLibre. V2 uses Standard/Hybrid descriptors; V1 uses named maps
 * (`rc-map-here-dev` / `rc-map-here-dark-dev`) as the rollback path.
 */
export function alsMapStyleUrl(theme: "dark" | "light" = "dark", extras?: AlsMapV2StyleOptions): string {
  if (isAlsMapApiV2()) {
    return buildAlsMapV2StyleUrl({
      ...extras,
      dark: extras?.dark ?? theme === "dark",
    });
  }
  return alsNamedMapStyleUrl(theme === "dark" ? "dark" : "standard");
}

export const RAPID_CORTEX_MAP_STYLES: Record<MapTheme, string> = {
  dark: alsMapStyleUrl("dark"),
  light: alsMapStyleUrl("light"),
  satellite: isAlsMapApiV2()
    ? buildAlsMapV2StyleUrl({ style: "Hybrid", dark: false })
    : alsNamedMapStyleUrl("standard"),
  streets: alsMapStyleUrl("light"),
};
