"use client";

import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import type { TransitVehicle } from "rapid-cortex-shared";
import type { RCIncident } from "@/components/maps/map-types";
import { T } from "./transit-theme";

function vehiclesToIncidents(vehicles: TransitVehicle[]): RCIncident[] {
  return vehicles
    .filter((v) => typeof v.lastLat === "number" && typeof v.lastLng === "number")
    .map((v) => ({
      id: v.vehicleId,
      status: v.status === "incident" ? "active" : v.status === "out_of_service" ? "closed" : "responding",
      severity:
        v.status === "incident" ? "critical" : v.status === "delayed" || v.status === "off_route" ? "high" : "low",
      type: v.mode,
      locationLabel: v.label,
      latitude: v.lastLat,
      longitude: v.lastLng,
      createdAt: v.gpsAt ?? v.updatedAt,
      agencyId: v.agencyId,
      description: v.status.replace(/_/g, " "),
    }));
}

export function TransitFleetMap({
  vehicles,
  onSelect,
  selectedVehicleId,
}: {
  vehicles: TransitVehicle[];
  selectedVehicleId?: string | null;
  onSelect?: (vehicleId: string) => void;
}) {
  const incidents = vehiclesToIncidents(vehicles);
  const first = incidents[0];
  return (
    <div
      style={{
        height: 420,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        overflow: "hidden",
        background: T.surface,
      }}
    >
      <RapidCortexMap
        incidents={incidents}
        selectedIncidentId={selectedVehicleId}
        onIncidentClick={(inc) => onSelect?.(inc.id)}
        centerLat={first?.latitude ?? 33.527}
        centerLng={first?.longitude ?? -86.799}
        zoom={11}
        height="420px"
        vertical="core"
        showLayerControl={false}
      />
    </div>
  );
}
