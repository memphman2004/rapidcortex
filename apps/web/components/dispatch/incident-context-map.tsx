"use client";

/**
 * Compact incident location map for the dispatcher CAD workspace.
 * Follows the dispatcher shell theme (dark vs light ALS Esri style).
 */
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import { useTheme } from "@/lib/theme/theme-context";

export function IncidentContextMap({
  latitude,
  longitude,
  label = "Incident",
  fill = false,
}: {
  latitude: number;
  longitude: number;
  label?: string;
  /** Fill the parent (dispatcher module pane). Compact preview when false. */
  fill?: boolean;
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
        // Street-level ops: ALS Esri tiles plus GeoJSON overlays.
        defaultLayers={{
          liveTraffic: true,
          liveTrafficClosures: true,
          airports: true,
        }}
        callerLocation={{
          lat: latitude,
          lng: longitude,
          label,
          source: "manual",
        }}
      />
    </div>
  );
}
