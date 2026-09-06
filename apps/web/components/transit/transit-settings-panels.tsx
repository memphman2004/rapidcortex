"use client";

import type { CSSProperties } from "react";
import type { TransitRoute, TransitVehicle } from "rapid-cortex-shared";
import { TransitVehicleModeIcon } from "./transit-vehicle-mode-icon";
import { T } from "./transit-theme";
import { canTransitSupervisorOps } from "@/lib/vertical/supervisor-access";
import { isTransitCamerasUiEnabled } from "@/lib/runtime-flags";
import { VenueCamerasSettingsClient } from "@/components/venue/venue-cameras-settings-client";
import { TransitCamerasConnectClient } from "./transit-cameras-connect-client";

export function TransitSettingsVehiclesPanel({ vehicles }: { vehicles: TransitVehicle[] }) {
  return (
    <div>
      <p style={{ color: T.textSecondary, fontSize: 13, marginBottom: 12 }}>
        Vehicle registry for this agency. Live cameras are on the Cameras page and each vehicle detail.
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {vehicles.map((vehicle) => (
          <li key={vehicle.vehicleId} style={rowStyle}>
            <TransitVehicleModeIcon mode={vehicle.mode} /> {vehicle.label} · {vehicle.vehicleId} ·{" "}
            {vehicle.status.replace(/_/g, " ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TransitSettingsRoutesPanel({ routes }: { routes: TransitRoute[] }) {
  return (
    <div>
      <p style={{ color: T.textSecondary, fontSize: 13, marginBottom: 12 }}>Route registry.</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
        {routes.map((route) => (
          <li key={route.routeId} style={rowStyle}>
            {route.name} · {route.mode.replace(/_/g, " ")} · {route.stationIds?.length ?? 0} stops
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Camera registry + Ring/Nest (campus/venue parity). Falls back to vehicle ID list if the flag is off. */
export function TransitSettingsCamerasPanel({
  agencyId,
  transitCode,
  userId,
  userRole,
  vehicles,
}: {
  agencyId: string;
  transitCode: string;
  userId: string;
  userRole: string;
  vehicles: TransitVehicle[];
}) {
  const camerasUi = isTransitCamerasUiEnabled();
  const canManage = canTransitSupervisorOps(userRole);
  if (!camerasUi) {
    return <TransitCameraIdList vehicles={vehicles} />;
  }
  return (
    <div style={{ display: "grid", gap: 24 }}>
      {canManage ? <VenueCamerasSettingsClient agencyId={agencyId} apiVertical="transit" /> : null}
      <TransitCamerasConnectClient
        agencyId={agencyId}
        transitCode={transitCode}
        userId={userId}
        userRole={userRole}
      />
      <TransitCameraIdList vehicles={vehicles} />
    </div>
  );
}

function TransitCameraIdList({ vehicles }: { vehicles: TransitVehicle[] }) {
  const rows = vehicles.flatMap((vehicle) =>
    (vehicle.cameraIds ?? []).map((cameraId) => ({ cameraId, vehicle })),
  );
  return (
    <div>
      <h2 style={{ margin: "0 0 8px", fontSize: 14, color: T.textPrimary }}>Vehicle camera IDs</h2>
      <p style={{ color: T.textSecondary, fontSize: 12, margin: "0 0 12px" }}>
        Optional IDs stored on fleet records. Registry cameras above rank by vehicle, then station, then route.
      </p>
      {rows.length === 0 ? (
        <p style={{ color: T.textSecondary, fontSize: 13 }}>
          No camera IDs stored on vehicle records. Register ONVIF/RTSP cameras above, or assign IDs on the vehicle.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <li key={`${row.vehicle.vehicleId}-${row.cameraId}`} style={rowStyle}>
              {row.cameraId} · {row.vehicle.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const rowStyle: CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 10,
  fontSize: 13,
  color: T.textPrimary,
  display: "flex",
  alignItems: "center",
  gap: 8,
};
