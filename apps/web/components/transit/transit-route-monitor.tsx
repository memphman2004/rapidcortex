"use client";

import type { CSSProperties } from "react";
import type { TransitIncident, TransitRoute, TransitStation, TransitVehicle } from "rapid-cortex-shared";
import { TransitVehicleModeIcon } from "./transit-vehicle-mode-icon";
import { T } from "./transit-theme";

export function TransitRouteMonitor({
  routes,
  vehicles,
  stations,
  incidents,
}: {
  routes: TransitRoute[];
  vehicles: TransitVehicle[];
  stations: TransitStation[];
  incidents: TransitIncident[];
}) {
  if (routes.length === 0) {
    return <div style={{ color: T.textSecondary, fontSize: 13 }}>No routes configured.</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
      {routes.map((route) => {
        const fleet = vehicles.filter((v) => v.routeId === route.routeId);
        const stops = stations.filter((s) => s.routeIds?.includes(route.routeId));
        const open = incidents.filter(
          (i) => i.routeId === route.routeId && i.status !== "closed" && i.status !== "resolved",
        );
        return (
          <li key={route.routeId} style={rowStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <TransitVehicleModeIcon mode={route.mode} />
              <strong>{route.name}</strong>
              <span style={{ color: T.textSecondary, fontSize: 12 }}>
                {route.mode.replace(/_/g, " ")}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary }}>
              {fleet.length} vehicles · {stops.length} stations · {open.length} open incidents
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TransitStationsPanel({
  stations,
  incidents,
}: {
  stations: TransitStation[];
  incidents: TransitIncident[];
}) {
  if (stations.length === 0) {
    return <div style={{ color: T.textSecondary, fontSize: 13 }}>No stations configured.</div>;
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
      {stations.map((station) => (
        <li key={station.stationId} style={rowStyle}>
          {station.name}
          {station.adaAccessible ? " · ADA" : ""} ·{" "}
          {
            incidents.filter((i) => i.stationId === station.stationId && i.status !== "closed").length
          }{" "}
          open
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
};
