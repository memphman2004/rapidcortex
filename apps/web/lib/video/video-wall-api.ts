import type {
  CameraHealthSummary,
  VideoTileAssignment,
  VideoWallConfig,
  VideoWallLayout,
} from "rapid-cortex-shared";

export type VideoWallHealthResponse = {
  summary: CameraHealthSummary;
  cameras: VideoTileAssignment[];
};

export async function fetchVideoWallConfig(agencyId: string): Promise<{
  config: VideoWallConfig | null;
  streamLimit: number;
}> {
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/wall/config`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Video wall config failed (${res.status})`);
  return (await res.json()) as { config: VideoWallConfig | null; streamLimit: number };
}

export async function saveVideoWallConfig(
  agencyId: string,
  body: { layout: VideoWallLayout; tiles: VideoTileAssignment[] },
): Promise<{ config: VideoWallConfig; streamLimit: number }> {
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/wall/config`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    config?: VideoWallConfig;
    streamLimit?: number;
    error?: string;
    code?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `Save failed (${res.status})`);
  if (!json.config) throw new Error("Invalid video wall response");
  return { config: json.config, streamLimit: json.streamLimit ?? 4 };
}

export async function fetchVideoCameraHealth(agencyId: string): Promise<VideoWallHealthResponse> {
  const res = await fetch(`/api/video/${encodeURIComponent(agencyId)}/cameras/health`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Camera health failed (${res.status})`);
  return (await res.json()) as VideoWallHealthResponse;
}
