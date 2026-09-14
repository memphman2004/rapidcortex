"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VideoClip, VideoFragment, VideoRecordingStatus } from "rapid-cortex-shared";
import {
  createVideoClip,
  fetchPlaybackSession,
  fetchRecordingFragments,
  fetchRecordingStatus,
  fetchVideoClip,
  listVideoClips,
  setCameraRecording,
} from "@/lib/video/dvr-api";
import { DVRClipExporter } from "./DVRClipExporter";
import { DVRFragmentBar } from "./DVRFragmentBar";
import { DVRPlayer } from "./DVRPlayer";
import { DVRTimeline } from "./DVRTimeline";

export function VideoDVR({
  agencyId,
  cameraId,
  displayName,
}: {
  agencyId: string;
  cameraId: string;
  displayName: string;
}) {
  const [endMs, setEndMs] = useState(() => Date.now());
  const [startMs, setStartMs] = useState(() => Date.now() - 60 * 60 * 1000);
  const [hlsUrl, setHlsUrl] = useState<string | null>(null);
  const [fragments, setFragments] = useState<VideoFragment[]>([]);
  const [recording, setRecording] = useState<VideoRecordingStatus | null>(null);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const durationSeconds = Math.round((endMs - startMs) / 1000);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [status, listed] = await Promise.all([
        fetchRecordingStatus(agencyId, cameraId),
        listVideoClips(agencyId, cameraId).catch(() => ({ clips: [] as VideoClip[] })),
      ]);
      setRecording(status);
      setClips(listed.clips);
      if (!status.enabled) {
        setHlsUrl(null);
        setFragments([]);
        return;
      }
      const startTimestamp = new Date(startMs).toISOString();
      const endTimestamp = new Date(endMs).toISOString();
      const [session, frag] = await Promise.all([
        fetchPlaybackSession(agencyId, cameraId, startTimestamp, endTimestamp).catch(() => null),
        fetchRecordingFragments(agencyId, cameraId, startTimestamp, endTimestamp).catch(() => ({ fragments: [] })),
      ]);
      setHlsUrl(session?.hlsUrl ?? null);
      setFragments(frag.fragments);
      if (!session) setError("No recorded footage for this window. The producer must ingest to the recording stream.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load playback");
    }
  }, [agencyId, cameraId, endMs, startMs]);

  useEffect(() => {
    void load();
  }, [load]);

  const clipRows = useMemo(() => clips.slice(0, 8), [clips]);

  async function toggleRecording(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      const next = await setCameraRecording(agencyId, cameraId, { enabled, retentionHours: 72 });
      setRecording(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update recording");
    } finally {
      setBusy(false);
    }
  }

  async function exportClip() {
    setExporting(true);
    setError(null);
    try {
      const created = await createVideoClip(agencyId, cameraId, {
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        label: `${displayName} clip`,
      });
      setClips((prev) => [created.clip, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export clip");
    } finally {
      setExporting(false);
    }
  }

  async function downloadClip(clipId: string) {
    try {
      const { clip } = await fetchVideoClip(agencyId, clipId, true);
      if (clip.downloadUrl) window.open(clip.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download clip");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-medium uppercase" style={{ color: "#c4b5fd" }}>
            {displayName}
          </div>
          <div className="text-[10px]" style={{ color: "#8b7bb5" }}>
            PLAYBACK · recording {recording?.enabled ? "on" : "off"}
            {recording?.retentionHours ? ` · ${recording.retentionHours}h retain` : ""}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          className="rounded px-2 py-1 text-[10px] uppercase"
          style={{ background: "#1a1528", color: "#c4b5fd" }}
          onClick={() => void toggleRecording(!recording?.enabled)}
        >
          {recording?.enabled ? "Disable recording" : "Enable recording"}
        </button>
      </div>
      {!recording?.enabled ? (
        <p className="text-[11px]" style={{ color: "#fcd34d" }}>
          Recording is opt-in. Enabling creates a KVS data stream and incurs storage cost. Live wall
          WebRTC is not attached to this stream by default.
        </p>
      ) : null}
      <div className="min-h-[220px] flex-1 overflow-hidden rounded" style={{ border: "1px solid #1a1528" }}>
        {hlsUrl ? (
          <DVRPlayer src={hlsUrl} label={`${displayName} playback`} />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px]" style={{ color: "#8b7bb5" }}>
            No HLS session for this window
          </div>
        )}
      </div>
      <DVRFragmentBar fragments={fragments} windowStart={startMs} windowEnd={endMs} />
      <DVRTimeline
        startMs={startMs}
        endMs={endMs}
        onChange={(s, e) => {
          setStartMs(s);
          setEndMs(e);
        }}
      />
      <DVRClipExporter durationSeconds={durationSeconds} busy={exporting} onExport={() => void exportClip()} />
      {error ? (
        <p className="text-[11px]" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      ) : null}
      {clipRows.length > 0 ? (
        <ul className="space-y-1 text-[11px]" style={{ color: "#c4b5fd" }}>
          {clipRows.map((clip) => (
            <li key={clip.clipId} className="flex items-center justify-between gap-2">
              <span>
                {clip.displayName} · {clip.status}
                {clip.locked ? " · locked" : ""}
              </span>
              {clip.status === "ready" ? (
                <button type="button" className="underline" onClick={() => void downloadClip(clip.clipId)}>
                  Download
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
