"use client";

/**
 * Compact incident location map for the dispatcher CAD workspace.
 * Follows the dispatcher shell theme (dark vs light Mapbox Studio style).
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
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

  if (!mapboxToken) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
        Map tiles are unavailable — Mapbox token is not configured for this environment.
        <p className="mt-1 font-mono text-[11px] text-amber-200/80">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      </div>
    );
  }

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
        // Street-level ops: traffic is the Studio overlay that actually paints here.
        // Counties/states in the published style max out at zoom 10 / 8.
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
