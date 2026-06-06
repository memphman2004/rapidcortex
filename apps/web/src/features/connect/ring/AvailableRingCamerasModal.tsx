"use client";

import { Info, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { RingCameraListItem, RingRequestStatus } from "rapid-cortex-integrations/ring";
import { RingCameraRequestCard } from "./RingCameraRequestCard";
import { isRingAvailableCamerasEnabled } from "./ring-feature-flags";
import type { RingAvailableCamerasResponse } from "./ring-types";

type OwnerStatus = RingRequestStatus | "AVAILABLE";

export function AvailableRingCamerasModal({
  incidentId,
  incidentLatitude: _incidentLatitude,
  incidentLongitude: _incidentLongitude,
  onClose,
}: {
  incidentId: string;
  incidentLatitude: number;
  incidentLongitude: number;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<RingCameraListItem[]>([]);
  const [statusMap, setStatusMap] = useState<Map<string, OwnerStatus>>(new Map());

  const load = useCallback(async (radius: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/ring/available-cameras?incidentId=${encodeURIComponent(incidentId)}&radiusMeters=${radius}`,
        { credentials: "include" },
      );
      const body = (await res.json()) as RingAvailableCamerasResponse;
      if (!res.ok || !body.success || !body.data) {
        setError("Could not load cameras. Please try again.");
        return;
      }
      setCameras(body.data.cameras);
      setStatusMap(
        new Map(body.data.cameras.map((camera: RingCameraListItem) => [camera.deviceId, camera.ownerStatus])),
      );
    } catch {
      setError("Could not load cameras. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    if (!isRingAvailableCamerasEnabled()) return;
    void load(radiusMeters);
  }, [load, radiusMeters]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const cameraCount = cameras.length;
  const rendered = useMemo(
    () =>
      cameras.map((camera) => ({
        ...camera,
        ownerStatus: statusMap.get(camera.deviceId) ?? camera.ownerStatus,
      })),
    [cameras, statusMap],
  );

  if (!isRingAvailableCamerasEnabled()) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4" role="presentation">
      <div
        className="mx-auto flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#2A3A4A] bg-[#0A0F1E]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-[#2A3A4A] px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold text-[#F0F4F8]">
            Available Ring Cameras Near Incident
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded p-1 text-[#8B9CB0] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="m-4 flex items-start gap-2 rounded border border-sky-500/30 bg-sky-950/20 p-3 text-sm text-sky-100">
          <Info size={16} className="mt-0.5" />
          <p>
            These cameras are linked by participating users and may be eligible for temporary emergency sharing.
            Rapid Cortex cannot view any camera until the owner approves the request.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded border border-[#2A3A4A] bg-[#1E2A3A]" />
              ))}
            </div>
          ) : null}
          {error ? (
            <div className="rounded border border-rose-500/40 bg-rose-950/20 p-3 text-sm text-rose-200">
              <p>{error}</p>
              <button type="button" className="mt-2 underline" onClick={() => void load(radiusMeters)}>
                Retry
              </button>
            </div>
          ) : null}
          {!loading && !error && cameraCount === 0 ? (
            <div className="rounded border border-[#2A3A4A] bg-[#1E2A3A] p-4 text-sm text-[#8B9CB0]">
              <p>No eligible Ring cameras found within 500m of this incident.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded border border-slate-600 px-2 py-1 text-xs" onClick={() => setRadiusMeters(1000)}>
                  Search 1,000m
                </button>
                <button type="button" className="rounded border border-slate-600 px-2 py-1 text-xs" onClick={() => setRadiusMeters(2000)}>
                  Search 2,000m
                </button>
              </div>
            </div>
          ) : null}
          {!loading && !error && cameraCount > 0 ? (
            <div className="space-y-3">
              {rendered.map((camera: RingCameraListItem) => (
                <RingCameraRequestCard
                  key={camera.deviceId}
                  camera={camera}
                  incidentId={incidentId}
                  onRequestSent={(deviceId) => {
                    setStatusMap((prev) => new Map(prev).set(deviceId, "SENT"));
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#2A3A4A] px-4 py-3 text-sm text-[#8B9CB0]">
          <span>
            Showing {cameraCount} cameras within {radiusMeters}m
          </span>
          <button type="button" className="rounded border border-slate-600 px-3 py-1.5 text-slate-100" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
