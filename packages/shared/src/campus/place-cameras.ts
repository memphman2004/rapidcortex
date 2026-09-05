import type { VenueCamera, VenueIncidentCameraSummary } from "../venue/camera-registry-schemas.js";

export type CampusCameraPlace = {
  buildingId: string;
  floor?: string | null;
  zoneCode?: string | null;
  qrRcli?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function cameraBuildingId(camera: VenueCamera): string {
  return norm(camera.buildingId || camera.sections[0]);
}

function cameraCoversBuilding(camera: VenueCamera, building: string): boolean {
  if (!building) return false;
  if (cameraBuildingId(camera) === building) return true;
  const stripped = building.replace(/^SECTION\s+/, "");
  return camera.sections.some((section) => {
    const ns = norm(section);
    return ns === building || ns === stripped;
  });
}

/**
 * Score a registry camera against an incident place.
 * Higher is closer. `-1` means the camera is out of place (wrong building).
 *
 * Rank: QR / RCLI (1000, even across buildings) > zone (50) > floor (20) > building (0),
 * plus inverse priorityRank.
 */
export function scoreCampusCameraForPlace(camera: VenueCamera, place: CampusCameraPlace): number {
  const placeQr = norm(place.qrRcli);
  const camQr = norm(camera.qrRcli);
  if (placeQr && camQr && placeQr === camQr) {
    return 1000 + Math.max(0, 100 - camera.priorityRank);
  }

  const building = norm(place.buildingId);
  if (!cameraCoversBuilding(camera, building)) return -1;

  let score = 0;
  const placeZone = norm(place.zoneCode);
  const camZone = norm(camera.zoneCode);
  if (placeZone && camZone && placeZone === camZone) score += 50;

  const placeFloor = norm(place.floor);
  const camFloor = norm(camera.floor);
  if (placeFloor && camFloor && placeFloor === camFloor) score += 20;

  score += Math.max(0, 100 - camera.priorityRank);
  return score;
}

export function toCampusCameraSummary(camera: VenueCamera): VenueIncidentCameraSummary {
  return {
    cameraId: camera.cameraId,
    displayName: camera.displayName,
    kvsChannelName: camera.kvsChannelName,
    vendor: camera.vendor,
    ptzCapable: camera.ptzCapable,
  };
}

/** Rank online-or-unknown cameras for an incident place. Offline cameras are excluded by the caller. */
export function rankCampusCamerasForPlace(
  cameras: VenueCamera[],
  place: CampusCameraPlace,
  limit = 2,
): VenueCamera[] {
  return cameras
    .map((camera) => ({ camera, score: scoreCampusCameraForPlace(camera, place) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.camera.priorityRank - b.camera.priorityRank)
    .slice(0, Math.max(1, limit))
    .map((row) => row.camera);
}

export type SelectCamerasForAreaScanOpts = {
  assignedCameraIds?: string[] | null;
  place: CampusCameraPlace;
  limit?: number;
  /** Fallback ranking excludes cameras for which this returns false. Assigned IDs skip this. */
  isEligibleFallback?: (camera: VenueCamera) => boolean;
};

/**
 * Resolve cameras for a QR/NFC/area scan.
 * Assigned inprocessing cameras always win (including offline), then ranked place matches.
 */
export function selectCamerasForAreaScan(
  cameras: VenueCamera[],
  opts: SelectCamerasForAreaScanOpts,
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
  for (const camera of rankCampusCamerasForPlace(fallbackPool, opts.place, limit - selected.length)) {
    if (seen.has(camera.cameraId)) continue;
    selected.push(camera);
    seen.add(camera.cameraId);
    if (selected.length >= limit) break;
  }
  return selected;
}
