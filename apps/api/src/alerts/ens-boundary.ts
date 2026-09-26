import {
  bufferPolygonOneMile,
  closePolygonRing,
  type EnsSiteBoundary,
  type AlertVertical,
} from "rapid-cortex-shared";
import { upsertZoneGeofence } from "../location/geofence.js";
import { alertsStore } from "./store.js";

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertEnsSiteBoundary(params: {
  agencyId: string;
  vertical: AlertVertical;
  boundaryPolygon: Array<[number, number]>;
}): Promise<EnsSiteBoundary> {
  const ring = closePolygonRing(params.boundaryPolygon);
  const outerRingOneMile = closePolygonRing(bufferPolygonOneMile(ring));
  const existing = await alertsStore.getEnsBoundary(params.agencyId, params.vertical);
  const boundary: EnsSiteBoundary = {
    agencyId: params.agencyId,
    vertical: params.vertical,
    boundaryPolygon: ring,
    outerRingOneMile,
    geofenceBoundaryZoneId: existing?.geofenceBoundaryZoneId ?? "ens-property-boundary",
    geofenceOuterZoneId: existing?.geofenceOuterZoneId ?? "ens-one-mile-ring",
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await alertsStore.putEnsBoundary(boundary);
  await upsertZoneGeofence(params.agencyId, boundary.geofenceBoundaryZoneId, ring);
  await upsertZoneGeofence(params.agencyId, boundary.geofenceOuterZoneId, outerRingOneMile);
  return boundary;
}
