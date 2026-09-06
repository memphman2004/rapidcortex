"use client";

import { useEffect, useState } from "react";
import type { TransitVehicle, VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import { isTransitCamerasUiEnabled } from "@/lib/runtime-flags";
import { KVSWebRTCPlayer } from "@/components/venue/KVSWebRTCPlayer";
import { T } from "./transit-theme";

export function TransitVehicleCamerasPanel({
  agencyId,
  vehicle,
}: {
  agencyId: string;
  vehicle: TransitVehicle;
}) {
  const enabled = isTransitCamerasUiEnabled();
  const [cameras, setCameras] = useState<VenueIncidentCameraSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void fetchVenueSectionCameras(agencyId, vehicle.vehicleId, 8, "transit", {
      routeId: vehicle.routeId,
      cameraIds: vehicle.cameraIds,
    })
      .then((rows) => {
        if (cancelled) return;
        setCameras(rows);
        setActiveId(rows[0]?.cameraId ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load cameras");
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId, enabled, vehicle.cameraIds, vehicle.routeId, vehicle.vehicleId]);

  if (!enabled) return null;

  const active = cameras.find((c) => c.cameraId === activeId) ?? cameras[0];

  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 14 }}>Live cameras</h2>
      {error ? <p style={{ color: T.red, fontSize: 12 }}>{error}</p> : null}
      {cameras.length === 0 && !error ? (
        <p style={{ color: T.textSecondary, fontSize: 13 }}>
          No registry cameras for this vehicle. Admins can add ONVIF/RTSP cameras on the Cameras page.
        </p>
      ) : null}
      {cameras.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {cameras.map((cam) => (
            <button
              key={cam.cameraId}
              type="button"
              onClick={() => setActiveId(cam.cameraId)}
              style={{
                background: cam.cameraId === active?.cameraId ? T.blueDim : T.surface,
                color: T.textPrimary,
                border: `1px solid ${cam.cameraId === active?.cameraId ? T.blue : T.border}`,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {cam.displayName}
            </button>
          ))}
        </div>
      ) : null}
      {active ? (
        <KVSWebRTCPlayer
          agencyId={agencyId}
          kvsChannelName={active.kvsChannelName}
          displayName={active.displayName}
          apiVertical="transit"
        />
      ) : null}
    </div>
  );
}
