import { calculateDistanceMeters } from "../geo/distance.js";
import type { VenueCamera, VenueIncidentCameraSummary } from "../venue/camera-registry-schemas.js";
import {
  rankCampusCamerasForPlace,
  selectCamerasForAreaScan,
  toCampusCameraSummary,
  type CampusCameraPlace,
  type SelectCamerasForAreaScanOpts,
} from "../campus/place-cameras.js";

export type GeoPoint = { latitude: number; longitude: number };

export const MILESTONE_GEO_DEFAULT_RADIUS_METERS = 150;
export const MILESTONE_GEO_MIN_RADIUS_METERS = 50;
export const MILESTONE_GEO_MAX_RADIUS_METERS = 500;
export const MILESTONE_CAMERA_ASSOCIATION_LIMIT = 4;

export function clampMilestoneRadiusMeters(radiusMeters: number | undefined): number {
  const n = Number.isFinite(radiusMeters) ? Number(radiusMeters) : MILESTONE_GEO_DEFAULT_RADIUS_METERS;
  return Math.min(
    MILESTONE_GEO_MAX_RADIUS_METERS,
    Math.max(MILESTONE_GEO_MIN_RADIUS_METERS, Math.round(n)),
  );
}

/**
 * Score a camera by haversine distance. Higher is closer.
 * Returns -1 when the camera lacks coordinates or is outside the radius.
 */
export function scoreCameraByGeoProximity(
  camera: VenueCamera,
  origin: GeoPoint,
  radiusMeters: number,
): number {
  if (camera.latitude == null || camera.longitude == null) return -1;
  const dist = calculateDistanceMeters(
    origin.latitude,
    origin.longitude,
    camera.latitude,
    camera.longitude,
  );
  if (dist > radiusMeters) return -1;
  // Prefer closer cameras; leave headroom above place scores (max ~1100 for QR).
  return 2000 - dist;
}

export function rankCamerasByGeoProximity(
  cameras: VenueCamera[],
  origin: GeoPoint,
  radiusMeters: number,
  limit = MILESTONE_CAMERA_ASSOCIATION_LIMIT,
): VenueCamera[] {
  const radius = clampMilestoneRadiusMeters(radiusMeters);
  return cameras
    .map((camera) => ({ camera, score: scoreCameraByGeoProximity(camera, origin, radius) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.camera.priorityRank - b.camera.priorityRank)
    .slice(0, Math.max(1, limit))
    .map((row) => row.camera);
}

export type SelectCamerasWithGeoOpts = SelectCamerasForAreaScanOpts & {
  origin?: GeoPoint | null;
  radiusMeters?: number;
};

/**
 * Merge place (QR/zone/floor) ranking with optional geo proximity.
 * Assigned IDs always win; then place matches; then geo fills remaining slots.
 */
export function selectCamerasForAreaScanWithGeo(
  cameras: VenueCamera[],
  opts: SelectCamerasWithGeoOpts,
): VenueCamera[] {
  const limit = Math.max(1, opts.limit ?? MILESTONE_CAMERA_ASSOCIATION_LIMIT);
  const placeSelected = selectCamerasForAreaScan(cameras, { ...opts, limit });
  if (!opts.origin || placeSelected.length >= limit) return placeSelected;

  const seen = new Set(placeSelected.map((c) => c.cameraId));
  const geoPool = cameras.filter((c) => !seen.has(c.cameraId));
  const geoSelected = rankCamerasByGeoProximity(
    geoPool,
    opts.origin,
    opts.radiusMeters ?? MILESTONE_GEO_DEFAULT_RADIUS_METERS,
    limit - placeSelected.length,
  );
  return [...placeSelected, ...geoSelected];
}

export function toMilestoneCameraSummaries(cameras: VenueCamera[]): VenueIncidentCameraSummary[] {
  return cameras.map(toCampusCameraSummary);
}

export type { CampusCameraPlace };
export { rankCampusCamerasForPlace };
