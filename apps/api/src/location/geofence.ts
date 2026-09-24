import {
  BatchDeleteGeofenceCommand,
  BatchPutGeofenceCommand,
  ListGeofencesCommand,
} from "@aws-sdk/client-location";
import {
  alsAgencyPrefix,
  alsScopedId,
  type AlsGeofenceListItem,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { getLocationClient, LocationNotConfiguredError } from "./client.js";

export function geofencesForAgency(
  agencyId: string,
  entries: Array<{
    GeofenceId?: string;
    Geometry?: { Polygon?: number[][][] };
  }>,
): AlsGeofenceListItem[] {
  const prefix = alsAgencyPrefix(agencyId);
  const out: AlsGeofenceListItem[] = [];
  for (const entry of entries) {
    const geofenceId = entry.GeofenceId?.trim() ?? "";
    if (!geofenceId.startsWith(prefix)) continue;
    const ring = entry.Geometry?.Polygon?.[0];
    if (!ring || ring.length < 3) continue;
    const polygon: [number, number][] = [];
    for (const pair of ring) {
      const lng = pair[0];
      const lat = pair[1];
      if (typeof lng !== "number" || typeof lat !== "number") continue;
      polygon.push([lng, lat]);
    }
    if (polygon.length < 3) continue;
    out.push({
      zoneId: geofenceId.slice(prefix.length) || geofenceId,
      geofenceId,
      polygon,
    });
  }
  return out;
}

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
  if (!env.alsGeofenceCollectionName) {
    throw new LocationNotConfiguredError("geofence collection");
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
  if (!env.alsGeofenceCollectionName) {
    throw new LocationNotConfiguredError("geofence collection");
  }
  await getLocationClient().send(
    new BatchDeleteGeofenceCommand({
      CollectionName: env.alsGeofenceCollectionName,
      GeofenceIds: [geofenceId],
    }),
  );
  return { geofenceId, mocked: false };
}

export async function listAgencyGeofences(agencyId: string): Promise<AlsGeofenceListItem[]> {
  if (!env.alsGeofenceCollectionName) return [];
  const entries: Array<{
    GeofenceId?: string;
    Geometry?: { Polygon?: number[][][] };
  }> = [];
  let nextToken: string | undefined;
  do {
    const page = await getLocationClient().send(
      new ListGeofencesCommand({
        CollectionName: env.alsGeofenceCollectionName,
        NextToken: nextToken,
      }),
    );
    for (const entry of page.Entries ?? []) {
      entries.push(entry);
    }
    nextToken = page.NextToken;
  } while (nextToken);
  return geofencesForAgency(agencyId, entries);
}
