"use client";

import { useEffect, useState } from "react";
import type { VideoPtzPreset } from "rapid-cortex-shared";
import { fetchPtzPresets, gotoPtzPreset, savePtzPreset } from "@/lib/video/ptz-api";

export function PTZPresetPanel({
  agencyId,
  cameraId,
}: {
  agencyId: string;
  cameraId: string;
}) {
  const [presets, setPresets] = useState<VideoPtzPreset[]>([]);
  const [name, setName] = useState("Home");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchPtzPresets(agencyId, cameraId)
      .then(setPresets)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load presets"));
  }, [agencyId, cameraId]);

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] uppercase" style={{ color: "#8b7bb5" }}>
        Presets
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((preset, index) => (
          <button
            key={preset.token}
            type="button"
            className="rounded px-2 py-1 text-[11px]"
            style={{ background: "#1a1528", color: "#c4b5fd" }}
            onClick={() => void gotoPtzPreset(agencyId, cameraId, preset.token).catch((err: unknown) => setError(err instanceof Error ? err.message : "Goto failed"))}
          >
            {index + 1}. {preset.name}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          className="min-w-0 flex-1 rounded px-2 py-1 text-[11px]"
          style={{ background: "#1a1528", color: "#e9d5ff", border: "1px solid #2e1065" }}
          value={name}
          maxLength={64}
          onChange={(e) => setName(e.target.value)}
          aria-label="Preset name"
        />
        <button
          type="button"
          className="rounded px-2 py-1 text-[11px]"
          style={{ background: "#6d28d9", color: "#f5f3ff" }}
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            void savePtzPreset(agencyId, cameraId, trimmed)
              .then(setPresets)
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Save failed"));
          }}
        >
          Save
        </button>
      </div>
      {error ? (
        <p className="text-[10px]" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
