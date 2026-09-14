"use client";

import { VIDEO_CLIP_MAX_SECONDS, VIDEO_CLIP_MIN_SECONDS } from "rapid-cortex-shared";

export function DVRClipExporter({
  durationSeconds,
  busy,
  onExport,
}: {
  durationSeconds: number;
  busy: boolean;
  onExport: () => void;
}) {
  const tooShort = durationSeconds < VIDEO_CLIP_MIN_SECONDS;
  const tooLong = durationSeconds > VIDEO_CLIP_MAX_SECONDS;
  const disabled = busy || tooShort || tooLong;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        className="rounded px-3 py-1.5 text-[11px] uppercase"
        style={{
          background: disabled ? "#1a1528" : "#6d28d9",
          color: disabled ? "#8b7bb5" : "#f5f3ff",
        }}
        onClick={onExport}
      >
        {busy ? "Exporting…" : "Export clip"}
      </button>
      <span className="text-[11px]" style={{ color: tooShort || tooLong ? "#fca5a5" : "#8b7bb5" }}>
        {tooShort
          ? `Select at least ${VIDEO_CLIP_MIN_SECONDS}s`
          : tooLong
            ? `KVS GetClip max is ${VIDEO_CLIP_MAX_SECONDS / 60} minutes`
            : `${durationSeconds}s selected`}
      </span>
    </div>
  );
}
