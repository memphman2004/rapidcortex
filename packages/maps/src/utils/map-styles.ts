import type { MapTheme } from "../types/map-types";

function alsStyleUrl(kind: "dark" | "standard"): string {
  const region =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_REGION?.trim()) || "us-east-1";
  const name =
    kind === "dark"
      ? (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_MAP_NAME_DARK?.trim()) ||
        "rc-map-dark-dev"
      : (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_ALS_MAP_NAME?.trim()) ||
        "rc-map-dev";
  return `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${name}/style-descriptor`;
}

export const RAPID_CORTEX_MAP_STYLES: Record<MapTheme, string> = {
  dark: alsStyleUrl("dark"),
  light: alsStyleUrl("standard"),
  satellite: alsStyleUrl("standard"),
  streets: alsStyleUrl("standard"),
};
