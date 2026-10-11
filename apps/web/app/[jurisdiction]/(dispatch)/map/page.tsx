"use client";

/**
 * Ops map surface for GIS A1 — full-bleed RapidCortexMap with Layers panel
 * (including approved GIS overlays). Same ALS/MapLibre stack as the dispatcher
 * workspace; no second map engine.
 */
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import { useSession } from "@/components/auth/session-context";
import { isGisEnabled } from "@/lib/runtime-flags";
import { useTheme } from "@/lib/theme/theme-context";

export default function JurisdictionOpsMapPage() {
  const { theme } = useTheme();
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-slate-500">
        Loading map…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full min-h-[480px]">
      {!isGisEnabled() && (
        <div className="absolute left-3 top-3 z-20 rounded-md border border-amber-800/50 bg-amber-950/80 px-3 py-1.5 text-xs text-amber-100">
          GIS overlays disabled for this environment
        </div>
      )}
      <RapidCortexMap
        key={theme}
        theme={theme}
        vertical="core"
        height="100%"
        showLayerControl
        enableGisLayers={isGisEnabled()}
        persistUserId={user.userId}
        allowNamedMapFallback
        defaultLayers={{
          liveTraffic: true,
          liveTrafficClosures: true,
          activeIncidents: true,
          psaps: true,
        }}
      />
    </div>
  );
}
