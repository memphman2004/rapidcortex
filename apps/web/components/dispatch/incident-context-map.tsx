"use client";

/**
 * Compact incident location map for the dispatcher CAD workspace.
 * Follows the dispatcher shell theme (dark vs light Amazon Location style).
 */
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import type { RCLiveCaller } from "@/components/maps/map-types";
import { useTheme } from "@/lib/theme/theme-context";

export function IncidentContextMap({
  latitude,
  longitude,
  label = "Incident",
  fill = false,
  liveCallers,
  incidentId,
  reportPin = true,
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
}) {
  const { theme } = useTheme();
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
        }}
        callerLocation={
          reportPin
            ? {
                lat: latitude,
                lng: longitude,
                label,
                source: "manual",
                incidentId,
              }
            : null
        }
        liveCallers={liveCallers}
      />
    </div>
  );
}
