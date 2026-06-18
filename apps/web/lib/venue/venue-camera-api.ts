import type {
  VenueCamera,
  VenueCameraDiscoverResponse,
  VenueCameraUpsertBody,
} from "rapid-cortex-shared";
import { venueKvsChannelName } from "rapid-cortex-shared";

export type CameraApiVertical = "venue" | "campus";

function camerasBase(vertical: CameraApiVertical, agencyId: string): string {
  return `/api/${vertical}/${encodeURIComponent(agencyId)}/cameras`;
}

export async function fetchVenueSectionCameras(
  agencyId: string,
  sectionId: string,
  limit = 10,
  vertical: CameraApiVertical = "venue",
) {
  const qs =
    vertical === "campus"
      ? new URLSearchParams({ building: sectionId, limit: String(limit) })
      : new URLSearchParams({ section: sectionId, limit: String(limit) });
  const res = await fetch(`${camerasBase(vertical, agencyId)}?${qs}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load cameras (${res.status})`);
  const body = (await res.json()) as { cameras?: unknown[] };
  return body.cameras ?? [];
}

export async function fetchVenueCameraRegistry(
  agencyId: string,
  vertical: CameraApiVertical = "venue",
): Promise<VenueCamera[]> {
  const res = await fetch(`${camerasBase(vertical, agencyId)}/registry`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load camera registry (${res.status})`);
  const body = (await res.json()) as { cameras?: VenueCamera[] };
  return body.cameras ?? [];
}

export async function createVenueCameraRegistryEntry(
  agencyId: string,
  payload: VenueCameraUpsertBody,
  vertical: CameraApiVertical = "venue",
): Promise<VenueCamera> {
  const res = await fetch(`${camerasBase(vertical, agencyId)}/registry`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create failed (${res.status})`);
  const body = (await res.json()) as { camera?: VenueCamera };
  if (!body.camera) throw new Error("Invalid response");
  return body.camera;
}

export async function updateVenueCameraRegistryEntry(
  agencyId: string,
  cameraId: string,
  payload: VenueCameraUpsertBody,
  vertical: CameraApiVertical = "venue",
): Promise<VenueCamera> {
  const res = await fetch(
    `${camerasBase(vertical, agencyId)}/registry/${encodeURIComponent(cameraId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  const body = (await res.json()) as { camera?: VenueCamera };
  if (!body.camera) throw new Error("Invalid response");
  return body.camera;
}

export async function deleteVenueCameraRegistryEntry(
  agencyId: string,
  cameraId: string,
  vertical: CameraApiVertical = "venue",
): Promise<void> {
  const res = await fetch(
    `${camerasBase(vertical, agencyId)}/registry/${encodeURIComponent(cameraId)}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

export async function discoverVenueOnvifCamera(
  agencyId: string,
  input: { ip: string; username?: string; password?: string; port?: number },
  vertical: CameraApiVertical = "venue",
): Promise<{
  discovered: VenueCameraDiscoverResponse;
  suggestedCameraId: string;
  suggestedKvsChannelName: string;
}> {
  const res = await fetch(`${camerasBase(vertical, agencyId)}/discover`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as {
    discovered?: VenueCameraDiscoverResponse;
    suggestedCameraId?: string;
    suggestedKvsChannelName?: string;
    error?: string;
  };
  if (!res.ok || !body.discovered) {
    throw new Error(body.error ?? `Discovery failed (${res.status})`);
  }
  return {
    discovered: body.discovered,
    suggestedCameraId: body.suggestedCameraId ?? `cam-${input.ip.replace(/\./g, "-")}`,
    suggestedKvsChannelName:
      body.suggestedKvsChannelName ??
      venueKvsChannelName(agencyId, body.suggestedCameraId ?? `cam-${input.ip.replace(/\./g, "-")}`),
  };
}

export async function downloadVenueProducerConfig(
  agencyId: string,
  vertical: CameraApiVertical = "venue",
): Promise<void> {
  const url = `${camerasBase(vertical, agencyId)}/producer-config`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `rc-kvs-producer-${agencyId.replace(/[^a-z0-9-]/gi, "-")}.yaml`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export async function postVenueCameraPtz(
  agencyId: string,
  cameraId: string,
  action: string,
  vertical: CameraApiVertical = "venue",
): Promise<void> {
  const res = await fetch(
    `${camerasBase(vertical, agencyId)}/${encodeURIComponent(cameraId)}/ptz`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    },
  );
  if (!res.ok) throw new Error(`PTZ failed (${res.status})`);
}

export type VenueIncidentUpdateRow = {
  updateId: string;
  incidentId: string;
  message: string;
  actorLabel: string;
  createdAt: string;
};

export async function fetchVenueIncidentUpdates(
  incidentId: string,
): Promise<VenueIncidentUpdateRow[]> {
  const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/updates`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load updates (${res.status})`);
  const body = (await res.json()) as { updates?: VenueIncidentUpdateRow[] };
  return body.updates ?? [];
}

export async function postVenueIncidentUpdate(
  incidentId: string,
  message: string,
): Promise<VenueIncidentUpdateRow> {
  const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/updates`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
  const body = (await res.json()) as { update?: VenueIncidentUpdateRow };
  if (!body.update) throw new Error("Invalid response");
  return body.update;
}

export async function patchVenueIncidentStatus(
  incidentId: string,
  status: "open" | "assigned" | "responding" | "resolved" | "escalated",
): Promise<void> {
  const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId)}/status`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Status update failed (${res.status})`);
}

export { venueKvsChannelName };
