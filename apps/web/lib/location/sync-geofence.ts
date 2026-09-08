import type { AlsGeofenceUpsertBody } from "rapid-cortex-shared";

/**
 * Sync a campus/venue/transit zone polygon to ALS (server-side).
 * No-op when the polygon is empty. Fail-open so zone saves still succeed.
 */
export async function syncZoneGeofence(zoneId: string, polygon: [number, number][]): Promise<void> {
  if (polygon.length < 3) return;
  const body: AlsGeofenceUpsertBody = { zoneId, polygon };
  try {
    await fetch("/api/location/geofences", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* fail-open — ALS sync must not block zone saves */
  }
}

export async function deleteSyncedZoneGeofence(zoneId: string): Promise<void> {
  const id = zoneId.trim();
  if (!id) return;
  try {
    await fetch(`/api/location/geofences/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    /* fail-open */
  }
}
