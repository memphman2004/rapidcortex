"use client";

import { Bell, Camera } from "lucide-react";
import { useState } from "react";
import type { RingCameraListItem } from "rapid-cortex-integrations/ring";
import { RingCameraRequestStatusBadge } from "./RingCameraRequestStatusBadge";

const DURATIONS = [10, 30, 60, 120] as const;

export function RingCameraRequestCard({
  camera,
  incidentId,
  onRequestSent,
}: {
  camera: RingCameraListItem;
  incidentId: string;
  onRequestSent?: (deviceId: string) => void;
}) {
  const [status, setStatus] = useState(camera.ownerStatus);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(30);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sendRequest = async () => {
    const ok = window.confirm(
      `Send an emergency video sharing request to the camera owner?\nDuration: ${duration} minutes. The owner must approve before any video is shared.`,
    );
    if (!ok) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/integrations/ring/request-camera-access", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId,
          deviceId: camera.deviceId,
          requestedDurationMinutes: duration,
        }),
      });
      if (res.status === 201) {
        setStatus("SENT");
        onRequestSent?.(camera.deviceId);
        return;
      }
      if (res.status === 409) {
        setToast("A request was already sent for this camera.");
        return;
      }
      if (res.status === 429) {
        setToast("Too many requests for this incident. Please wait before trying again.");
        return;
      }
      setToast("Failed to send request. Please try again.");
    } catch {
      setToast("Failed to send request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-[#2A3A4A] bg-[#1E2A3A] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#F0F4F8]">
          {camera.deviceType === "DOORBELL" ? <Bell size={15} /> : <Camera size={15} />}
          <span className="text-sm">{camera.deviceName}</span>
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px]">{camera.deviceType}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-[#8B9CB0]">~{camera.distanceMeters}m away</p>
        <RingCameraRequestStatusBadge status={status} />
      </div>

      {status === "AVAILABLE" ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`rounded border px-2 py-1 text-xs ${
                  d === duration ? "border-sky-400 text-sky-200" : "border-slate-600 text-slate-300"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void sendRequest()}
            disabled={busy}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Sending Request..." : "Send Emergency Video Request"}
          </button>
        </div>
      ) : null}

      {(status === "SENT" || status === "OPENED") && (
        <p className="mt-3 text-sm text-amber-300">Waiting for owner response...</p>
      )}
      {status === "APPROVED" && (
        <div className="mt-3">
          <button
            type="button"
            disabled
            title="Live stream viewer available in next update."
            className="cursor-not-allowed rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-400"
          >
            View Stream
          </button>
        </div>
      )}
      {status === "DECLINED" && <p className="mt-3 text-sm text-rose-300">Owner Declined</p>}
      {(status === "EXPIRED" || status === "REVOKED") && (
        <button type="button" className="mt-3 text-sm text-sky-300 underline" onClick={() => setStatus("AVAILABLE")}>
          Send new request →
        </button>
      )}

      {toast ? <p className="mt-2 text-xs text-rose-300">{toast}</p> : null}
    </div>
  );
}
