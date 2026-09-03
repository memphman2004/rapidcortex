"use client";

import type { TransitIncident, TransitOperator, TransitVehicle } from "rapid-cortex-shared";
import { TransitVehicleModeIcon } from "./transit-vehicle-mode-icon";
import { T } from "./transit-theme";

export function TransitVehicleDetailClient({
  vehicle,
  operator,
  incidents,
}: {
  vehicle: TransitVehicle;
  operator?: TransitOperator;
  incidents: TransitIncident[];
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <TransitVehicleModeIcon mode={vehicle.mode} size={18} />
          <h1 style={{ margin: 0, fontSize: 18 }}>{vehicle.label}</h1>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, textTransform: "uppercase" }}>
          {vehicle.status.replace(/_/g, " ")} · {vehicle.mode.replace(/_/g, " ")}
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, marginTop: 16, fontSize: 13 }}>
          <dt style={{ color: T.textSecondary }}>Route</dt>
          <dd style={{ margin: 0 }}>{vehicle.routeId ?? "—"}</dd>
          <dt style={{ color: T.textSecondary }}>Operator</dt>
          <dd style={{ margin: 0 }}>{operator?.displayName ?? vehicle.operatorId ?? "Unassigned"}</dd>
          <dt style={{ color: T.textSecondary }}>GPS</dt>
          <dd style={{ margin: 0 }}>
            {typeof vehicle.lastLat === "number" && typeof vehicle.lastLng === "number"
              ? `${vehicle.lastLat.toFixed(5)}, ${vehicle.lastLng.toFixed(5)}`
              : "No fix"}
          </dd>
          <dt style={{ color: T.textSecondary }}>Speed</dt>
          <dd style={{ margin: 0 }}>
            {typeof vehicle.speedKph === "number" ? `${Math.round(vehicle.speedKph)} km/h` : "—"}
          </dd>
          <dt style={{ color: T.textSecondary }}>Last GPS</dt>
          <dd style={{ margin: 0 }}>{vehicle.gpsAt ?? "—"}</dd>
          <dt style={{ color: T.textSecondary }}>Cameras</dt>
          <dd style={{ margin: 0 }}>{vehicle.cameraIds?.join(", ") || "None registered"}</dd>
        </dl>
      </div>
      <div>
        <h2
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.textSecondary,
          }}
        >
          Incident history
        </h2>
        {incidents.length === 0 ? (
          <p style={{ color: T.textSecondary, fontSize: 13 }}>No incidents for this vehicle.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {incidents.map((incident) => (
              <li
                key={incident.incidentId}
                style={{
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 13,
                }}
              >
                <strong>{incident.type}</strong> · {incident.status} — {incident.summary}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
