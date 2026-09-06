import type { VenueCamera, VenueIncidentCameraSummary } from "../venue/camera-registry-schemas.js";

export type TransitCameraPlace = {
  vehicleId?: string | null;
  stationId?: string | null;
  routeId?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function cameraVehicleId(camera: VenueCamera): string {
  return norm(camera.vehicleId || camera.sections[0]);
}

function cameraCoversVehicle(camera: VenueCamera, vehicleId: string): boolean {
  if (!vehicleId) return false;
  if (cameraVehicleId(camera) === vehicleId) return true;
  return camera.sections.some((section) => norm(section) === vehicleId);
}

/**
 * Score a registry camera against a transit incident place.
 * Higher is closer. `-1` means the camera is out of place.
 *
 * Rank: assigned IDs are handled by the caller. Vehicle (80) > station (50) > route (20),
 * plus inverse priorityRank.
 */
export function scoreTransitCameraForPlace(camera: VenueCamera, place: TransitCameraPlace): number {
  const vehicle = norm(place.vehicleId);
  const station = norm(place.stationId);
  const route = norm(place.routeId);
  if (!vehicle && !station && !route) return Math.max(0, 100 - camera.priorityRank);

  let score = -1;
  if (vehicle && cameraCoversVehicle(camera, vehicle)) score = Math.max(score, 80);
  if (station && norm(camera.stationId) === station) score = Math.max(score, 50);
  if (route && norm(camera.routeId) === route) score = Math.max(score, 20);
  if (score < 0) return -1;
  return score + Math.max(0, 100 - camera.priorityRank);
}

export function toTransitCameraSummary(camera: VenueCamera): VenueIncidentCameraSummary {
  return {
    cameraId: camera.cameraId,
    displayName: camera.displayName,
    kvsChannelName: camera.kvsChannelName,
    vendor: camera.vendor,
    ptzCapable: camera.ptzCapable,
    status: camera.status,
    vehicleId: camera.vehicleId,
    stationId: camera.stationId,
    routeId: camera.routeId,
  };
}

export function rankTransitCamerasForPlace(
  cameras: VenueCamera[],
  place: TransitCameraPlace,
  limit = 2,
): VenueCamera[] {
  return cameras
    .map((camera) => ({ camera, score: scoreTransitCameraForPlace(camera, place) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.camera.priorityRank - b.camera.priorityRank)
    .slice(0, Math.max(1, limit))
    .map((row) => row.camera);
}

export type SelectTransitCamerasOpts = {
  assignedCameraIds?: string[] | null;
  place: TransitCameraPlace;
  limit?: number;
  isEligibleFallback?: (camera: VenueCamera) => boolean;
};

/** Assigned vehicle camera IDs win (including offline), then ranked place matches. */
export function selectCamerasForTransitPlace(
  cameras: VenueCamera[],
  opts: SelectTransitCamerasOpts,
): VenueCamera[] {
  const limit = Math.max(1, opts.limit ?? 2);
  const byId = new Map(cameras.map((camera) => [camera.cameraId, camera]));
  const selected: VenueCamera[] = [];
  const seen = new Set<string>();

  for (const rawId of opts.assignedCameraIds ?? []) {
    const id = rawId.trim();
    const camera = byId.get(id);
    if (!camera || seen.has(camera.cameraId)) continue;
    selected.push(camera);
    seen.add(camera.cameraId);
    if (selected.length >= limit) return selected;
  }

  const fallbackPool = cameras.filter((camera) => {
    if (seen.has(camera.cameraId)) return false;
    return opts.isEligibleFallback ? opts.isEligibleFallback(camera) : true;
  });
  for (const camera of rankTransitCamerasForPlace(fallbackPool, opts.place, limit - selected.length)) {
    if (seen.has(camera.cameraId)) continue;
    selected.push(camera);
    seen.add(camera.cameraId);
    if (selected.length >= limit) break;
  }
  return selected;
}
