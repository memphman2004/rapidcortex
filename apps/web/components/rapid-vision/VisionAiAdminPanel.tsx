"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isRapidVisionSceneAdminEnabled } from "@/lib/runtime-flags";

type CameraRow = {
  cameraId: string;
  friendlyName: string;
  zoneLabel: string;
  connectionStatus: string;
  aiMonitoringEnabled: boolean;
  sceneSensitivity: "low" | "medium" | "high" | "maximum";
  sceneCooldownSeconds: number;
  provider: string;
};

type Settings = {
  sceneIntelEnabled?: boolean;
  sceneIntelMinSeverity?: "critical" | "high" | "medium" | "low";
  sceneIntelClaudeEnabled?: boolean;
  sceneIntelAudioEnabled?: boolean;
  sceneIntelSupervisorPushEnabled?: boolean;
};

async function jsonGet<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

export function VisionAiAdminPanel() {
  const queryClient = useQueryClient();
  const enabled = isRapidVisionSceneAdminEnabled();

  const camerasQuery = useQuery({
    queryKey: ["vision-scene-cameras"],
    queryFn: async () => {
      const body = await jsonGet<{ data?: { cameras?: CameraRow[] } }>("/api/vision/cameras");
      return body?.data?.cameras ?? [];
    },
    enabled,
  });

  const settingsQuery = useQuery({
    queryKey: ["vision-scene-settings"],
    queryFn: async () => {
      const body = await jsonGet<{ data?: Settings }>("/api/vision/settings");
      return body?.data ?? {};
    },
    enabled,
  });

  const patchSettings = useMutation({
    mutationFn: async (patch: Settings) => {
      const res = await fetch("/api/vision/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("settings_patch_failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["vision-scene-settings"] }),
  });

  const patchCamera = useMutation({
    mutationFn: async (params: { cameraId: string; body: Partial<CameraRow> }) => {
      const res = await fetch(`/api/vision/cameras/${encodeURIComponent(params.cameraId)}/config`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params.body),
      });
      if (!res.ok) throw new Error("camera_config_failed");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["vision-scene-cameras"] }),
  });

  if (!enabled) {
    return <p className="text-sm text-slate-400">Scene Intelligence admin is disabled.</p>;
  }

  const settings = settingsQuery.data ?? {};
  const cameras = camerasQuery.data ?? [];

  return (
    <div className="space-y-6 text-slate-200">
      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">Agency defaults</h2>
        <p className="mt-1 text-xs text-slate-500">
          AI surfaces alerts. Dispatchers confirm. Nothing auto-dispatches.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sceneIntelEnabled !== false}
              onChange={(e) => patchSettings.mutate({ sceneIntelEnabled: e.target.checked })}
            />
            Enable Scene Intelligence
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sceneIntelClaudeEnabled !== false}
              onChange={(e) => patchSettings.mutate({ sceneIntelClaudeEnabled: e.target.checked })}
            />
            Claude scene descriptions
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sceneIntelAudioEnabled !== false}
              onChange={(e) => patchSettings.mutate({ sceneIntelAudioEnabled: e.target.checked })}
            />
            Alert audio tone
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.sceneIntelSupervisorPushEnabled !== false}
              onChange={(e) => patchSettings.mutate({ sceneIntelSupervisorPushEnabled: e.target.checked })}
            />
            Supervisor push on HIGH/CRITICAL
          </label>
          <label className="text-sm">
            Minimum severity
            <select
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={settings.sceneIntelMinSeverity ?? "low"}
              onChange={(e) =>
                patchSettings.mutate({
                  sceneIntelMinSeverity: e.target.value as Settings["sceneIntelMinSeverity"],
                })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">Per-camera AI monitoring</h2>
        {camerasQuery.isLoading ? (
          <p className="mt-3 text-sm text-slate-500">Loading cameras…</p>
        ) : cameras.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No cameras registered for this agency.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {cameras.map((camera) => (
              <li key={camera.cameraId} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{camera.friendlyName}</p>
                  <p className="text-xs text-slate-500">
                    {camera.zoneLabel || "No zone"} · {camera.connectionStatus} · {camera.provider}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={camera.aiMonitoringEnabled}
                    onChange={(e) =>
                      patchCamera.mutate({
                        cameraId: camera.cameraId,
                        body: { aiMonitoringEnabled: e.target.checked },
                      })
                    }
                  />
                  Monitor
                </label>
                <select
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  value={camera.sceneSensitivity}
                  onChange={(e) =>
                    patchCamera.mutate({
                      cameraId: camera.cameraId,
                      body: { sceneSensitivity: e.target.value as CameraRow["sceneSensitivity"] },
                    })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="maximum">Maximum</option>
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
