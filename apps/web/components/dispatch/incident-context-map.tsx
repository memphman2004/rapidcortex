"use client";

/**
 * Compact incident location map for the dispatcher CAD workspace.
 * Follows the dispatcher shell theme (dark vs light Amazon Location style).
 */
import { useMemo } from "react";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import { reportLocationToMapIncident } from "@/components/maps/map-incident-adapters";
import type { RCIncident, RCLiveCaller } from "@/components/maps/map-types";
import { useTheme } from "@/lib/theme/theme-context";

export function IncidentContextMap({
  latitude,
  longitude,
  label = "Incident",
  fill = false,
  liveCallers,
  incidentId,
  reportPin = true,
  incidents,
}: {
  latitude: number;
  longitude: number;
  label?: string;
  /** Fill the parent (dispatcher module pane). Compact preview when false. */
  fill?: boolean;
  liveCallers?: RCLiveCaller[];
  incidentId?: string;
  /** CAD / incident report pin. False when the map is centered only on live GPS. */
  reportPin?: boolean;
  /** Open incidents to plot as pulsing red markers. */
  incidents?: RCIncident[];
}) {
  const { theme } = useTheme();
  const mapIncidents = useMemo(() => {
    if (incidents && incidents.length > 0) return incidents;
    if (!reportPin) return [];
    return [
      reportLocationToMapIncident({
        id: incidentId,
        latitude,
        longitude,
        locationLabel: label,
      }),
    ];
  }, [incidents, reportPin, incidentId, latitude, longitude, label]);
  return (
    <div
      className={
        fill
          ? "h-full min-h-0 w-full overflow-hidden"
          : "h-48 overflow-hidden rounded-lg border border-slate-700"
      }
    >
      <RapidCortexMap
        key={theme}
        theme={theme}
        vertical="core"
        centerLat={latitude}
        centerLng={longitude}
        zoom={15}
        height="100%"
        showLayerControl
        // Street-level ops: ALS tiles plus GeoJSON overlays.
        defaultLayers={{
          liveTraffic: true,
          liveTrafficClosures: true,
          airports: true,
          activeIncidents: true,
        }}
        incidents={mapIncidents}
        selectedIncidentId={incidentId ?? mapIncidents[0]?.id}
        liveCallers={liveCallers}
      />
    </div>
  );
}
