"use client";

import type { CSSProperties } from "react";
import type { TransitRoute, TransitVehicle } from "rapid-cortex-shared";
import { TransitVehicleModeIcon } from "./transit-vehicle-mode-icon";
import { T } from "./transit-theme";

export function TransitSettingsVehiclesPanel({ vehicles }: { vehicles: TransitVehicle[] }) {
  return (
    <div>
      <p style={{ color: T.textSecondary, fontSize: 13, marginBottom: 12 }}>
        Vehicle registry for this agency. Camera IDs are listed on each vehicle (no PTZ).
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

/** Camera IDs registered on vehicles — list only, no Ring/PTZ. */
export function TransitSettingsCamerasPanel({ vehicles }: { vehicles: TransitVehicle[] }) {
  const rows = vehicles.flatMap((vehicle) =>
    (vehicle.cameraIds ?? []).map((cameraId) => ({ cameraId, vehicle })),
  );
  if (rows.length === 0) {
    return (
      <p style={{ color: T.textSecondary, fontSize: 13 }}>
        No camera IDs registered on vehicles. This is a registry list only — no PTZ.
      </p>
    );
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {rows.map((row) => (
        <li key={`${row.vehicle.vehicleId}-${row.cameraId}`} style={rowStyle}>
          {row.cameraId} · {row.vehicle.label}
        </li>
      ))}
    </ul>
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
