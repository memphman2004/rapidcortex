"use client";

import type { TransitVehicle, TransitVehicleStatus } from "rapid-cortex-shared";
import Link from "next/link";
import { T } from "./transit-theme";
import { TransitVehicleModeIcon } from "./transit-vehicle-mode-icon";

const STATUS_COLOR: Record<TransitVehicleStatus, string> = {
  in_service: T.green,
  delayed: T.amber,
  incident: T.red,
  off_route: T.orange,
  out_of_service: T.textMuted,
};

export function TransitVehiclePanel({
  vehicles,
  linkBase,
}: {
  vehicles: TransitVehicle[];
  linkBase: string;
}) {
  if (vehicles.length === 0) {
    return (
      <div style={{ color: T.textSecondary, fontSize: 13, padding: 16 }}>No vehicles on duty.</div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}
    >
      {vehicles.map((vehicle) => (
        <Link
          key={vehicle.vehicleId}
          href={`${linkBase}/fleet/${encodeURIComponent(vehicle.vehicleId)}`}
          style={{
            position: "relative",
            textDecoration: "none",
            background: T.surfaceAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: 12,
            color: T.textPrimary,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: STATUS_COLOR[vehicle.status],
              animation: vehicle.status === "incident" ? "pulse 1.2s ease-in-out infinite" : undefined,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <TransitVehicleModeIcon mode={vehicle.mode} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{vehicle.label}</span>
          </div>
          <div style={{ fontSize: 11, color: T.textSecondary, textTransform: "uppercase" }}>
            {vehicle.status.replace(/_/g, " ")}
            {vehicle.routeId ? ` · ${vehicle.routeId}` : ""}
          </div>
        </Link>
      ))}
    </div>
  );
}
