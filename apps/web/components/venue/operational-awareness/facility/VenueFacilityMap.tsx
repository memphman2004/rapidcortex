"use client";

import { Expand, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState, type WheelEvent } from "react";
import type { FacilityLayerId, FacilityMapRendererProps, VenueDemoIncident } from "rapid-cortex-shared";
import { C } from "@/lib/theme/rc-theme-tokens";
import { MapIconButton } from "../MapIconButton";
import { IncidentFocusPanel } from "../incidents/IncidentFocusPanel";
import { FacilityLayerSelector } from "./FacilityLayerSelector";
import { FacilityLevelSelector } from "./FacilityLevelSelector";
import { FacilityMapLegend } from "./FacilityMapLegend";
import { FacilitySvgRenderer } from "./FacilitySvgRenderer";
import { FacilityZoneDetails } from "./FacilityZoneDetails";

const DEFAULT_VIEW = { x: 0, y: 0, scale: 1, rotation: 0 };

export function VenueFacilityMap({
  venue,
  venueCode,
  activeLevelId,
  selectedIncidentId,
  selectedZoneId,
  selectedAssetId,
  visibleLayers,
  onIncidentSelect,
  onZoneSelect,
  onAssetSelect,
  onLevelChange,
  onToggleLayer,
  onExpand,
  onPopOut,
  onNotifyStaff,
  liveIncidentHref,
  showLayers,
  showReturnSplit,
  onReturnSplit,
  showExpand = true,
}: FacilityMapRendererProps & {
  venueCode: string;
  selectedAssetId?: string | null;
  onLevelChange: (id: string) => void;
  onToggleLayer: (id: FacilityLayerId) => void;
  onExpand: () => void;
  onPopOut: () => void;
  onNotifyStaff?: () => void;
  liveIncidentHref?: string | null;
  showLayers: boolean;
  showReturnSplit?: boolean;
  onReturnSplit?: () => void;
  showExpand?: boolean;
}) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const selectedZone = venue.zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const focusIncident: VenueDemoIncident | null =
    venue.demoIncidents?.find((item) => item.id === selectedIncidentId) ?? null;
  const zoneAssets = useMemo(
    () => venue.assets.filter((asset) => asset.zoneId && asset.zoneId === selectedZoneId),
    [venue.assets, selectedZoneId],
  );
  const zoneIncidentCount = selectedZone
    ? (venue.demoIncidents ?? []).filter((item) => item.zoneId === selectedZone.id).length
    : 0;

  const onWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.92 : 1.08;
    setView((prev) => ({ ...prev, scale: Math.min(2.4, Math.max(0.7, prev.scale * delta)) }));
  }, []);

  return (
    <div className="relative h-full min-h-0 overflow-hidden" style={{ background: "#10141c" }} onWheel={onWheel}>
      <div className="absolute left-3 top-3 z-20 max-w-[70%]">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400">Demo Facility Model</div>
        <div className="text-[11px] text-slate-400">Illustrative operational layout — not an official floor plan</div>
        {showReturnSplit && onReturnSplit ? (
          <button
            type="button"
            onClick={onReturnSplit}
            className="mt-1 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200 hover:border-orange-500"
            style={{ borderColor: C.border, background: C.card }}
          >
            Back to split view
          </button>
        ) : null}
      </div>

      <div className="absolute left-3 top-[4.6rem] z-20 flex flex-col gap-1">
        <MapIconButton label="Zoom in" onClick={() => setView((prev) => ({ ...prev, scale: Math.min(2.4, prev.scale * 1.15) }))}>
          <Plus size={14} />
        </MapIconButton>
        <MapIconButton label="Zoom out" onClick={() => setView((prev) => ({ ...prev, scale: Math.max(0.7, prev.scale / 1.15) }))}>
          <Minus size={14} />
        </MapIconButton>
        <MapIconButton label="Rotate" onClick={() => setView((prev) => ({ ...prev, rotation: (prev.rotation + 15) % 360 }))}>
          <span className="block text-[10px] font-bold">↻</span>
        </MapIconButton>
        <MapIconButton label="Reset view" onClick={() => setView(DEFAULT_VIEW)}>
          <RotateCcw size={14} />
        </MapIconButton>
        <div className="pt-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {venue.levels.filter((level) => level.enabled).length} Levels
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 flex gap-1">
        {showExpand ? (
          <MapIconButton label="Expand facility map" onClick={onExpand}>
            <Expand size={14} />
          </MapIconButton>
        ) : null}
        <MapIconButton label="Open in window" onClick={onPopOut}>
          <Maximize2 size={14} />
        </MapIconButton>
      </div>

      <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2">
        <FacilityLevelSelector levels={venue.levels} activeLevelId={activeLevelId ?? ""} onChange={onLevelChange} />
      </div>

      {showLayers ? (
        <FacilityLayerSelector
          configured={venue.facilityLayers}
          visible={new Set(visibleLayers)}
          onToggle={onToggleLayer}
        />
      ) : null}

      <FacilitySvgRenderer
        venue={venue}
        activeLevelId={activeLevelId}
        selectedIncidentId={selectedIncidentId}
        selectedZoneId={selectedZoneId}
        visibleLayers={visibleLayers}
        onIncidentSelect={onIncidentSelect}
        onZoneSelect={onZoneSelect}
        onAssetSelect={onAssetSelect}
        viewTransform={view}
      />

      <FacilityMapLegend />

      {selectedZone ? (
        <FacilityZoneDetails
          zone={selectedZone}
          assets={zoneAssets}
          incidentCount={zoneIncidentCount}
          venueCode={venueCode}
          onClose={() => onZoneSelect("")}
        />
      ) : null}

      {focusIncident ? (
        <IncidentFocusPanel
          incident={focusIncident}
          venueCode={venueCode}
          liveIncidentHref={liveIncidentHref}
          onNotifyStaff={onNotifyStaff}
          onClose={() => onIncidentSelect("")}
        />
      ) : null}

      {selectedAssetId ? (
        <div className="sr-only" aria-live="polite">
          Selected asset {selectedAssetId}
        </div>
      ) : null}
      <ul className="sr-only">
        {(venue.demoIncidents ?? [])
          .filter((incident) => !activeLevelId || incident.levelId === activeLevelId)
          .map((incident) => (
            <li key={incident.id}>
              <button type="button" onClick={() => onIncidentSelect(incident.id)}>
                {incident.title}, {incident.locationLabel}, section {incident.section}, {incident.status}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}
