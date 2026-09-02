"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isApiConfigured,
  postIncidentAudioChunk,
  postLanguageSessionFinalize,
  postLanguageSessionStart,
} from "@/lib/api";

const CHUNK_MS = 2000;

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Dispatcher mic capture: language-session start + complete WebM clips posted to audio-chunks.
 * Each clip is its own MediaRecorder so Azure/Whisper receive a valid container (not Matroska fragments).
 */
export function LiveCallSttCapture({
  incidentId,
  preferredLanguageHint,
  disabled,
  onStreamingChange,
}: {
  incidentId: string | null;
  preferredLanguageHint?: string | null;
  disabled?: boolean;
  onStreamingChange?: (streaming: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sequenceRef = useRef(0);
  const runningRef = useRef(false);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendQueueRef = useRef(Promise.resolve());

  const stopTracks = useCallback(() => {
    if (cycleTimerRef.current) {
      clearTimeout(cycleTimerRef.current);
      cycleTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const sendChunk = useCallback(
    async (blob: Blob) => {
      const incident = incidentId;
      const sessionId = sessionIdRef.current;
      if (!incident || !sessionId || blob.size < 64) return;
      const audioBase64 = await blobToBase64(blob);
      const sequence = sequenceRef.current;
      const out = await postIncidentAudioChunk(incident, {
        sessionId,
        sequence,
        audioBase64,
        format: "webm",
        durationMs: CHUNK_MS,
        speaker: "caller",
      });
      sequenceRef.current = sequence + 1;
      setStatus(`${out.sttProvider} · ${out.languageCode}${out.sttFallbackUsed ? " (fallback)" : ""}`);
      await queryClient.invalidateQueries({ queryKey: ["transcript", incident] });
    },
    [incidentId, queryClient],
  );

  const enqueueChunk = useCallback(
    (blob: Blob) => {
      sendQueueRef.current = sendQueueRef.current
        .then(() => sendChunk(blob))
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "STT chunk failed");
        });
    },
    [sendChunk],
  );

  const recordOneClip = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !runningRef.current) return;
    const mime = pickRecorderMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    rec.ondataavailable = (ev) => {
      if (ev.data.size > 0) enqueueChunk(ev.data);
    };
    rec.onerror = () => setError("Microphone recorder failed");
    rec.start();
    cycleTimerRef.current = setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
      if (runningRef.current) recordOneClip();
    }, CHUNK_MS);
  }, [enqueueChunk]);

  const stop = useCallback(async () => {
    runningRef.current = false;
    stopTracks();
    const sessionId = sessionIdRef.current;
    const incident = incidentId;
    sessionIdRef.current = null;
    setRunning(false);
    onStreamingChange?.(false);
    if (incident && sessionId) {
      try {
        await postLanguageSessionFinalize(incident, sessionId);
      } catch {
        /* session may already be finalized */
      }
    }
  }, [incidentId, onStreamingChange, stopTracks]);

  const start = useCallback(async () => {
    if (!incidentId || !isApiConfigured()) return;
    setError(null);
    setStatus("Starting language session…");
    try {
      const hint = preferredLanguageHint?.trim();
      const session = await postLanguageSessionStart(incidentId, hint ? { preferredLanguageHint: hint } : {});
      sessionIdRef.current = session.sessionId;
      sequenceRef.current = 0;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      runningRef.current = true;
      setRunning(true);
      onStreamingChange?.(true);
      setStatus("Listening — Azure STT (OpenAI / AWS fallback)");
      recordOneClip();
    } catch (e) {
      runningRef.current = false;
      stopTracks();
      sessionIdRef.current = null;
      setRunning(false);
      onStreamingChange?.(false);
      setError(e instanceof Error ? e.message : "Could not start live STT");
    }
  }, [incidentId, onStreamingChange, preferredLanguageHint, recordOneClip, stopTracks]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      stopTracks();
    };
  }, [stopTracks]);

  useEffect(() => {
    if (disabled && running) void stop();
  }, [disabled, running, stop]);

  const canStart = Boolean(incidentId) && isApiConfigured() && !disabled && !running;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Live call STT</span>
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <button
            type="button"
            onClick={() => void stop()}
            className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-600"
          >
            Stop listening
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={!canStart}
            className="rounded-md bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-40"
          >
            Listen to caller
          </button>
        )}
        {status ? <span className="text-xs text-slate-400">{status}</span> : null}
      </div>
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
    </div>
  );
}
