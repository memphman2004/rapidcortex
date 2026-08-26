"use client";

import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import type { RCIncident, RCMapCommand, RCOperationalOverlay } from "@/components/maps/map-types";
import { C } from "@/lib/theme/rc-theme-tokens";
import { ExteriorMapControls } from "./ExteriorMapControls";
import { ExteriorMapLegend } from "./ExteriorMapLegend";
import type { ExteriorLayerId } from "rapid-cortex-shared";

export function ExteriorOperationalMap({
  venueName,
  center,
  zoom,
  pitch = 0,
  bearing = 0,
  isDemo,
  is3d,
  sectionPolygons,
  theme,
  persistUserId,
  incidents,
  selectedIncidentId,
  overlays,
  mapCommand,
  configuredLayers,
  visibleLayers,
  onThemeChange,
  onIncidentClick,
  onOverlayClick,
  onToggleLayer,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggle3d,
  onExpand,
  onPopOut,
  showReturnSplit,
  onReturnSplit,
  showExpand = true,
}: {
  venueName: string;
  center: [number, number];
  zoom: number;
  pitch?: number;
  bearing?: number;
  isDemo?: boolean;
  is3d?: boolean;
  sectionPolygons?: GeoJSON.FeatureCollection | null;
  theme: "dark" | "light";
  persistUserId: string | null;
  incidents: RCIncident[];
  selectedIncidentId: string | null;
  overlays: RCOperationalOverlay[];
  mapCommand: RCMapCommand | null;
  configuredLayers: readonly ExteriorLayerId[];
  visibleLayers: ReadonlySet<string>;
  onThemeChange: (theme: "dark" | "light") => void;
  onIncidentClick: (incident: RCIncident) => void;
  onOverlayClick: (overlay: RCOperationalOverlay) => void;
  onToggleLayer: (id: ExteriorLayerId) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggle3d?: () => void;
  onExpand: () => void;
  onPopOut: () => void;
  showReturnSplit?: boolean;
  onReturnSplit?: () => void;
  showExpand?: boolean;
}) {
  return (
    <div className="relative h-full min-h-0 overflow-hidden" style={{ background: C.surface }}>
      <div className="pointer-events-none absolute left-3 top-3 z-20">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Area Map</div>
        <div className="text-[12px] font-semibold text-slate-200">{venueName}</div>
        {isDemo ? (
          <div className="text-[10px] text-slate-500">Illustrative 3D sections — not a surveyed floor plan</div>
        ) : null}
      </div>
      {showReturnSplit && onReturnSplit ? (
        <button
          type="button"
          onClick={onReturnSplit}
          className="absolute left-3 top-12 z-20 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200 hover:border-orange-500"
          style={{ borderColor: C.border, background: C.card }}
        >
          Back to split view
        </button>
      ) : null}
      <ExteriorMapControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFit={onFit}
        onToggle3d={onToggle3d}
        is3d={is3d}
        onExpand={onExpand}
        onPopOut={onPopOut}
        expandLabel={showReturnSplit ? "Already expanded" : "Expand area map"}
        showExpand={showExpand}
      />
      <ExteriorMapLegend
        configured={configuredLayers}
        visible={visibleLayers}
        onToggle={onToggleLayer}
      />
      <RapidCortexMap
        theme={theme}
        onThemeChange={onThemeChange}
        persistUserId={persistUserId}
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        onIncidentClick={onIncidentClick}
        operationalOverlays={overlays}
        onOverlayClick={onOverlayClick}
        mapCommand={mapCommand}
        showZoomControl={false}
        showLayerControl={false}
        vertical="venue"
        height="100%"
        centerLng={center[0]}
        centerLat={center[1]}
        zoom={zoom}
        pitch={pitch}
        bearing={bearing}
        sectionPolygons={sectionPolygons}
        sectionExtrusion={Boolean(is3d)}
        defaultLayers={{
          venueZones: !sectionPolygons?.features.length,
          agencyZones: false,
          counties: false,
          activeIncidents: visibleLayers.has("incidents"),
        }}
      />
    </div>
  );
}
