import {
  BatchDeleteGeofenceCommand,
  BatchPutGeofenceCommand,
} from "@aws-sdk/client-location";
import { alsScopedId } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { alsLocationMockEnabled, getLocationClient } from "./client.js";

export async function upsertZoneGeofence(
  agencyId: string,
  zoneId: string,
  polygon: [number, number][],
): Promise<{ geofenceId: string; mocked: boolean }> {
  const geofenceId = alsScopedId(agencyId, zoneId);
  const closedPolygon = [...polygon];
  const first = closedPolygon[0];
  const last = closedPolygon[closedPolygon.length - 1];
  if (
    first &&
    last &&
    (first[0] !== last[0] || first[1] !== last[1])
  ) {
    closedPolygon.push(first);
  }
  if (alsLocationMockEnabled() || !env.alsGeofenceCollectionName) {
    return { geofenceId, mocked: true };
  }
  await getLocationClient().send(
    new BatchPutGeofenceCommand({
      CollectionName: env.alsGeofenceCollectionName,
      Entries: [
        {
          GeofenceId: geofenceId,
          Geometry: { Polygon: [closedPolygon] },
        },
      ],
    }),
  );
  return { geofenceId, mocked: false };
}

export async function deleteZoneGeofence(
  agencyId: string,
  zoneId: string,
): Promise<{ geofenceId: string; mocked: boolean }> {
  const geofenceId = alsScopedId(agencyId, zoneId);
  if (alsLocationMockEnabled() || !env.alsGeofenceCollectionName) {
    return { geofenceId, mocked: true };
  }
  await getLocationClient().send(
    new BatchDeleteGeofenceCommand({
      CollectionName: env.alsGeofenceCollectionName,
      GeofenceIds: [geofenceId],
    }),
  );
  return { geofenceId, mocked: false };
}
