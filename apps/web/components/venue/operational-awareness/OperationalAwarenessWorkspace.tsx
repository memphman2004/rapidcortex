"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExteriorLayerId, FacilityLayerId, OperationalViewMode } from "rapid-cortex-shared";
import type { RCIncident, RCMapCommand, RCMapCommandBody } from "@/components/maps/map-types";
import { C } from "@/lib/theme/rc-theme-tokens";
import { defaultFacilityLevelId, resolveVenueOperationalMap } from "@/lib/venue/operational-awareness/resolve-operational-map";
import { buildDemoVenueSectionGeoJSON } from "@/lib/venue/operational-awareness/demo-section-geojson";
import { VENUE_MAPBOX_ISO } from "@/lib/venue/operational-awareness/venue-map-config";
import { buildExteriorOverlays } from "@/lib/venue/operational-awareness/layers";
import { demoIncidentsToMap, resolveIncidentFocus } from "@/lib/venue/operational-awareness/focus";
import { openOperationalMapWindow } from "@/lib/venue/operational-awareness/pop-out";
import { publishOperationalSelection, subscribeOperationalSelection } from "@/lib/venue/operational-awareness/sync-channel";
import { OperationalAwarenessHeader } from "./OperationalAwarenessHeader";
import { OperationalStatusStrip } from "./OperationalStatusStrip";
import { ExteriorOperationalMap } from "./exterior/ExteriorOperationalMap";
import { VenueFacilityMap } from "./facility/VenueFacilityMap";
import { ResizableMapSplit } from "./layout/ResizableMapSplit";

function useStackedMaps(): boolean {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setStacked(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return stacked;
}

export function OperationalAwarenessWorkspace({
  venueCode,
  venueName,
  persistUserId,
  mapTheme,
  onMapThemeChange,
  liveIncidents,
  selectedIncidentId,
  onIncidentSelect,
  activeIncidents,
  staffOnDuty,
  camerasOnline,
  medicalResources,
  facilityAlerts,
  onRefresh,
  onNotifyStaff,
  lockedViewMode,
  compact,
}: {
  venueCode: string;
  venueName: string;
  persistUserId: string | null;
  mapTheme: "dark" | "light";
  onMapThemeChange: (theme: "dark" | "light") => void;
  liveIncidents: RCIncident[];
  selectedIncidentId: string | null;
  onIncidentSelect: (id: string | null) => void;
  activeIncidents: number;
  staffOnDuty: number;
  camerasOnline: number;
  medicalResources: number;
  facilityAlerts: number;
  onRefresh: () => void;
  onNotifyStaff?: () => void;
  lockedViewMode?: Exclude<OperationalViewMode, "split">;
  compact?: boolean;
}) {
  const map = useMemo(
    () => resolveVenueOperationalMap(venueCode, venueName),
    [venueCode, venueName],
  );
  const stacked = useStackedMaps();
  const [viewMode, setViewMode] = useState<OperationalViewMode>(lockedViewMode ?? "split");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [activeLevelId, setActiveLevelId] = useState(() => defaultFacilityLevelId(map));
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [command, setCommand] = useState<RCMapCommand | null>(null);
  const [is3d, setIs3d] = useState(true);
  const [visibleExterior, setVisibleExterior] = useState<Set<string>>(
    () => new Set(map.exteriorLayers),
  );
  const [visibleFacility, setVisibleFacility] = useState<Set<string>>(
    () => new Set(map.facilityLayers),
  );

  useEffect(() => {
    if (lockedViewMode) setViewMode(lockedViewMode);
  }, [lockedViewMode]);

  const filteredIncidents = useMemo(() => {
    const demo = demoIncidentsToMap(map);
    const live = liveIncidents.filter((item) => !demo.some((row) => row.id === item.id));
    const merged = [...live, ...demo];
    return visibleExterior.has("incidents") ? merged : [];
  }, [liveIncidents, map, visibleExterior]);

  const overlays = useMemo(
    () => buildExteriorOverlays(map, visibleExterior),
    [map, visibleExterior],
  );

  const sectionPolygons = useMemo(() => buildDemoVenueSectionGeoJSON(map), [map]);
  const areaZoom = Math.max(map.exterior.zoom, VENUE_MAPBOX_ISO.zoom);
  const areaPitch = is3d ? VENUE_MAPBOX_ISO.pitch : 0;
  const areaBearing = VENUE_MAPBOX_ISO.bearing;

  const issueCommand = useCallback((next: RCMapCommandBody) => {
    setCommand({ ...next, id: Date.now() });
  }, []);

  const applyIncident = useCallback(
    (id: string | null, publish = true) => {
      onIncidentSelect(id);
      const focus = resolveIncidentFocus(map, id, liveIncidents);
      if (focus?.levelId) setActiveLevelId(focus.levelId);
      if (focus?.zoneId) setSelectedZoneId(focus.zoneId);
      if (publish) {
        publishOperationalSelection({
          venueId: map.venueId,
          incidentId: id,
          zoneId: focus?.zoneId ?? null,
          levelId: focus?.levelId ?? null,
        });
      }
    },
    [liveIncidents, map, onIncidentSelect],
  );

  useEffect(() => {
    return subscribeOperationalSelection(map.venueId, (message) => {
      if (message.incidentId !== selectedIncidentId) {
        applyIncident(message.incidentId, false);
      }
      if (message.zoneId) setSelectedZoneId(message.zoneId);
      if (message.levelId) setActiveLevelId(message.levelId);
    });
  }, [applyIncident, map.venueId, selectedIncidentId]);

  useEffect(() => {
    if (!selectedIncidentId) return;
    const focus = resolveIncidentFocus(map, selectedIncidentId, liveIncidents);
    if (focus?.levelId) setActiveLevelId(focus.levelId);
    if (focus?.zoneId) setSelectedZoneId(focus.zoneId);
  }, [liveIncidents, map, selectedIncidentId]);

  const mode = lockedViewMode ?? viewMode;
  const popOutKind = mode === "area" ? "area" : "facility";

  const liveHref =
    selectedIncidentId && !selectedIncidentId.startsWith("INC-DEMO")
      ? `/venue/${encodeURIComponent(venueCode)}/incidents/${encodeURIComponent(selectedIncidentId)}`
      : null;

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden"
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        height: compact ? "100%" : 560,
      }}
    >
      {lockedViewMode ? null : (
        <OperationalAwarenessHeader
          viewMode={mode}
          onViewMode={setViewMode}
          onResetLayout={() => {
            setSplitRatio(0.5);
            setViewMode("split");
            issueCommand({
              type: "fit",
              center: map.exterior.center,
              zoom: areaZoom,
              bounds: map.exterior.bounds,
              pitch: areaPitch,
              bearing: areaBearing,
            });
          }}
          onRefresh={onRefresh}
          onToggleLayers={() => setLayersOpen((value) => !value)}
          onPopOut={() => openOperationalMapWindow(venueCode, popOutKind, selectedIncidentId)}
          layersOpen={layersOpen}
        />
      )}
      <OperationalStatusStrip
        activeIncidents={activeIncidents}
        staffOnDuty={staffOnDuty}
        camerasOnline={camerasOnline}
        medicalResources={medicalResources}
        facilityAlerts={facilityAlerts}
      />
      <div className="min-h-0 flex-1">
        <ResizableMapSplit
          ratio={splitRatio}
          onRatioChange={setSplitRatio}
          stacked={stacked && mode === "split"}
          leftHidden={mode === "facility"}
          rightHidden={mode === "area"}
          left={
            <ExteriorOperationalMap
              venueName={map.name}
              center={map.exterior.center}
              zoom={areaZoom}
              pitch={areaPitch}
              bearing={areaBearing}
              isDemo={map.isDemo}
              is3d={is3d}
              sectionPolygons={sectionPolygons}
              theme={mapTheme}
              persistUserId={persistUserId}
              incidents={filteredIncidents}
              selectedIncidentId={selectedIncidentId}
              overlays={overlays}
              mapCommand={command}
              configuredLayers={map.exteriorLayers}
              visibleLayers={visibleExterior}
              onThemeChange={onMapThemeChange}
              onIncidentClick={(incident) => applyIncident(incident.id)}
              onOverlayClick={(overlay) => setSelectedAssetId(overlay.id)}
              onToggleLayer={(id: ExteriorLayerId) => {
                setVisibleExterior((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onZoomIn={() => issueCommand({ type: "zoom-in" })}
              onZoomOut={() => issueCommand({ type: "zoom-out" })}
              onFit={() =>
                issueCommand({
                  type: "fit",
                  center: map.exterior.center,
                  zoom: areaZoom,
                  bounds: map.exterior.bounds,
                  pitch: areaPitch,
                  bearing: areaBearing,
                })
              }
              onToggle3d={() => {
                const next = !is3d;
                setIs3d(next);
                issueCommand({
                  type: "camera",
                  pitch: next ? VENUE_MAPBOX_ISO.pitch : 0,
                  bearing: VENUE_MAPBOX_ISO.bearing,
                  center: map.exterior.center,
                  zoom: areaZoom,
                });
              }}
              onExpand={() => setViewMode(mode === "area" ? "split" : "area")}
              onPopOut={() => openOperationalMapWindow(venueCode, "area", selectedIncidentId)}
              showReturnSplit={mode === "area" && !lockedViewMode}
              onReturnSplit={() => setViewMode("split")}
              showExpand={!lockedViewMode}
            />
          }
          right={
            <VenueFacilityMap
              venue={map}
              venueCode={venueCode}
              activeLevelId={activeLevelId}
              selectedIncidentId={selectedIncidentId}
              selectedZoneId={selectedZoneId}
              selectedAssetId={selectedAssetId}
              visibleLayers={[...visibleFacility]}
              onIncidentSelect={(id) => applyIncident(id || null)}
              onZoneSelect={(id) => setSelectedZoneId(id || null)}
              onAssetSelect={setSelectedAssetId}
              onLevelChange={setActiveLevelId}
              onToggleLayer={(id: FacilityLayerId) => {
                setVisibleFacility((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onExpand={() => setViewMode(mode === "facility" ? "split" : "facility")}
              onPopOut={() => openOperationalMapWindow(venueCode, "facility", selectedIncidentId)}
              onNotifyStaff={onNotifyStaff}
              liveIncidentHref={liveHref}
              showLayers={layersOpen || Boolean(lockedViewMode)}
              showReturnSplit={mode === "facility" && !lockedViewMode}
              onReturnSplit={() => setViewMode("split")}
              showExpand={!lockedViewMode}
            />
          }
        />
      </div>
    </div>
  );
}
