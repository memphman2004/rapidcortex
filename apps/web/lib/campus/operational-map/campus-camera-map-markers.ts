import type { VenueCamera } from "rapid-cortex-shared";
import { polygonCentroid } from "./campus-map-config";
import type { CampusMapMarker } from "./overpass-to-campus-geojson";

function buildingCentroid(
  buildings: GeoJSON.FeatureCollection | null,
  buildingId: string | undefined,
): { lat: number; lng: number } | null {
  const needle = (buildingId ?? "").trim().toLowerCase();
  if (!buildings || !needle) return null;
  for (const feature of buildings.features) {
    const props = feature.properties ?? {};
    const ids = [props.rcBuildingId, props.buildingId, props.label, props.sectionId]
      .map((v) => String(v ?? "").trim().toLowerCase())
      .filter(Boolean);
    if (!ids.includes(needle) && !ids.some((id) => id.includes(needle) || needle.includes(id))) {
      continue;
    }
    return polygonCentroid(feature.geometry);
  }
  return null;
}

/** Plot registry cameras that have coordinates, or fall back to the mapped building footprint. */
export function campusCameraMapMarkers(
  cameras: VenueCamera[],
  buildings: GeoJSON.FeatureCollection | null,
): CampusMapMarker[] {
  const markers: CampusMapMarker[] = [];
  for (const camera of cameras) {
    const coords =
      camera.latitude != null && camera.longitude != null
        ? { lat: camera.latitude, lng: camera.longitude }
        : buildingCentroid(buildings, camera.buildingId || camera.sections[0]);
    if (!coords) continue;
    markers.push({
      id: `cam-${camera.cameraId}`,
      type: "camera",
      label: camera.displayName,
      lat: coords.lat,
      lng: coords.lng,
    });
  }
  return markers;
}

export function overlayPointMarkers(overlay: GeoJSON.FeatureCollection | null): CampusMapMarker[] {
  if (!overlay) return [];
  const out: CampusMapMarker[] = [];
  for (const feature of overlay.features) {
    if (feature.geometry?.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (typeof lng !== "number" || typeof lat !== "number") continue;
    const label = String(feature.properties?.label ?? feature.properties?.name ?? "GIS overlay");
    out.push({
      id: String(feature.id ?? `gis-${out.length}`),
      type: "gis",
      label,
      lat,
      lng,
    });
  }
  return out;
}
