import type { VideoPtzDirection, VideoPtzPreset } from "rapid-cortex-shared";

async function videoJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `PTZ failed (${res.status})`);
  return json;
}

function ptzUrl(agencyId: string, cameraId: string, path: string): string {
  return `/api/video/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cameraId)}/ptz/${path}`;
}

export async function sendPtzMove(
  agencyId: string,
  cameraId: string,
  direction: VideoPtzDirection,
  speed: number,
): Promise<void> {
  await videoJson(
    await fetch(ptzUrl(agencyId, cameraId, "move"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction, speed }),
    }),
  );
}

export async function sendPtzStop(agencyId: string, cameraId: string): Promise<void> {
  await videoJson(
    await fetch(ptzUrl(agencyId, cameraId, "stop"), {
      method: "POST",
      credentials: "include",
    }),
  );
}

export async function sendPtzZoom(
  agencyId: string,
  cameraId: string,
  direction: "in" | "out",
  speed: number,
): Promise<void> {
  await videoJson(
    await fetch(ptzUrl(agencyId, cameraId, "zoom"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ direction, speed }),
    }),
  );
}

export async function fetchPtzPresets(agencyId: string, cameraId: string): Promise<VideoPtzPreset[]> {
  const json = await videoJson<{ presets: VideoPtzPreset[] }>(
    await fetch(ptzUrl(agencyId, cameraId, "presets"), { credentials: "include" }),
  );
  return json.presets ?? [];
}

export async function gotoPtzPreset(agencyId: string, cameraId: string, presetToken: string): Promise<void> {
  await videoJson(
    await fetch(ptzUrl(agencyId, cameraId, "preset/goto"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presetToken }),
    }),
  );
}

export async function savePtzPreset(agencyId: string, cameraId: string, presetName: string): Promise<VideoPtzPreset[]> {
  const json = await videoJson<{ presets: VideoPtzPreset[] }>(
    await fetch(ptzUrl(agencyId, cameraId, "preset/save"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presetName }),
    }),
  );
  return json.presets ?? [];
}
