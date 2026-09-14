import type { VideoClip, VideoFragment, VideoPlaybackSession, VideoRecordingStatus } from "rapid-cortex-shared";

async function videoJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as T & { error?: string; code?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Video request failed (${res.status})`);
  }
  return json;
}

export async function fetchPlaybackSession(
  agencyId: string,
  cameraId: string,
  startTimestamp: string,
  endTimestamp: string,
): Promise<VideoPlaybackSession> {
  const qs = new URLSearchParams({ startTimestamp, endTimestamp });
  const res = await fetch(
    `/api/video/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cameraId)}/playback-session?${qs}`,
    { credentials: "include" },
  );
  return videoJson<VideoPlaybackSession>(res);
}

export async function fetchRecordingFragments(
  agencyId: string,
  cameraId: string,
  startTimestamp: string,
  endTimestamp: string,
): Promise<{ fragments: VideoFragment[] }> {
  const qs = new URLSearchParams({ startTimestamp, endTimestamp });
  const res = await fetch(
    `/api/video/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cameraId)}/fragments?${qs}`,
    { credentials: "include" },
  );
  return videoJson<{ fragments: VideoFragment[] }>(res);
}

export async function fetchRecordingStatus(agencyId: string, cameraId: string): Promise<VideoRecordingStatus> {
  const res = await fetch(
    `/api/video/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cameraId)}/recording-status`,
    { credentials: "include" },
  );
  return videoJson<VideoRecordingStatus>(res);
}

export async function setCameraRecording(
  agencyId: string,
  cameraId: string,
  body: { enabled: boolean; retentionHours?: 24 | 72 | 168 | 336 | 720 },
): Promise<VideoRecordingStatus> {
  const res = await fetch(
    `/api/video/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cameraId)}/recording`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return videoJson<VideoRecordingStatus>(res);
}

export async function createVideoClip(
  agencyId: string,
  cameraId: string,
  body: { startTime: string; endTime: string; incidentId?: string; label?: string },
): Promise<{ clip: VideoClip }> {
  const res = await fetch(
    `/api/video/${encodeURIComponent(agencyId)}/cameras/${encodeURIComponent(cameraId)}/clips`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return videoJson<{ clip: VideoClip }>(res);
}

export async function listVideoClips(
  agencyId: string,
  cameraId?: string,
): Promise<{ clips: VideoClip[] }> {
  const qs = new URLSearchParams();
  if (cameraId) qs.set("cameraId", cameraId);
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/clips?${qs}`, {
    credentials: "include",
  });
  return videoJson<{ clips: VideoClip[] }>(res);
}

export async function fetchVideoClip(
  agencyId: string,
  clipId: string,
  download = false,
): Promise<{ clip: VideoClip }> {
  const qs = download ? "?download=1" : "";
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/clips/${encodeURIComponent(clipId)}${qs}`, {
    credentials: "include",
  });
  return videoJson<{ clip: VideoClip }>(res);
}

export async function lockVideoClip(agencyId: string, clipId: string): Promise<{ clip: VideoClip }> {
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/clips/${encodeURIComponent(clipId)}/lock`, {
    method: "POST",
    credentials: "include",
  });
  return videoJson<{ clip: VideoClip }>(res);
}

export async function deleteVideoClip(agencyId: string, clipId: string): Promise<void> {
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/clips/${encodeURIComponent(clipId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await videoJson<{ deleted: boolean }>(res);
}
