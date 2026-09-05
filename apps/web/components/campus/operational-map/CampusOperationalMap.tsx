"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Building2 } from "lucide-react";
import type { CampusBuildingSummary, VenueCamera } from "rapid-cortex-shared";
import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
import type { RCIncident, RCMapCommand, RCMapCommandBody, RCOperationalOverlay } from "@/components/maps/map-types";
import { C } from "@/lib/theme/rc-theme-tokens";
import type { CampusMapConfig } from "@/lib/campus/operational-map/campus-map-config";
import {
  buildCampusMapConfig,
  mergeCampusBuildingStatus,
  mergeCampusMapPolygons,
} from "@/lib/campus/operational-map/campus-map-config";
import { campusCameraMapMarkers, overlayPointMarkers } from "@/lib/campus/operational-map/campus-camera-map-markers";
import type { CampusMapMarker } from "@/lib/campus/operational-map/overpass-to-campus-geojson";
import { fetchVenueCameraRegistry } from "@/lib/venue/venue-camera-api";

function markerToOverlay(marker: CampusMapMarker): RCOperationalOverlay | null {
  if (marker.type === "aed") {
    return { id: marker.id, longitude: marker.lng, latitude: marker.lat, kind: "aed", label: marker.label };
  }
  if (marker.type === "emergencyPhone") {
    return {
      id: marker.id,
      longitude: marker.lng,
      latitude: marker.lat,
      kind: "emergencyPhone",
      label: marker.label,
    };
  }
  if (marker.type === "parking") {
    return { id: marker.id, longitude: marker.lng, latitude: marker.lat, kind: "parking", label: marker.label };
  }
  if (marker.type === "camera") {
    return { id: marker.id, longitude: marker.lng, latitude: marker.lat, kind: "camera", label: marker.label };
  }
  if (marker.type === "gis") {
    return { id: marker.id, longitude: marker.lng, latitude: marker.lat, kind: "security", label: marker.label };
  }
  return null;
}

export function CampusOperationalMap({
  campusCode,
  campusName,
  agencyId,
  buildings,
  incidents,
  selectedIncidentId,
  persistUserId,
  theme,
  onThemeChange,
  onIncidentClick,
  height = "372px",
}: {
  campusCode: string;
  campusName: string;
  agencyId?: string;
  buildings: CampusBuildingSummary[];
  incidents: RCIncident[];
  selectedIncidentId: string | null;
  persistUserId: string | null;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  onIncidentClick: (incident: RCIncident) => void;
  height?: string;
}) {
  const [config, setConfig] = useState<CampusMapConfig>(() => buildCampusMapConfig(campusCode, campusName));
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [overlay, setOverlay] = useState<GeoJSON.FeatureCollection | null>(null);
  const [markers, setMarkers] = useState<CampusMapMarker[]>([]);
  const [registryCameras, setRegistryCameras] = useState<VenueCamera[]>([]);
  const [is3d, setIs3d] = useState(true);
  const [command, setCommand] = useState<RCMapCommand | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  useEffect(() => {
    setConfig(buildCampusMapConfig(campusCode, campusName));
    setGeojson(null);
    setOverlay(null);
    setMarkers([]);
    setRegistryCameras([]);
  }, [campusCode, campusName]);

  useEffect(() => {
    let cancelled = false;
    const code = encodeURIComponent(campusCode);
    void (async () => {
      try {
        const [configRes, buildingsRes, markersRes, overlayRes] = await Promise.all([
          fetch(`/api/campus/code/${code}/map-config`, { credentials: "include" }),
          fetch(`/api/campus/code/${code}/map/buildings`, { credentials: "include" }),
          fetch(`/api/campus/code/${code}/map/markers`, { credentials: "include" }),
          fetch(`/api/campus/code/${code}/map/overlay`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (configRes.ok) setConfig((await configRes.json()) as CampusMapConfig);
        if (buildingsRes.ok) setGeojson((await buildingsRes.json()) as GeoJSON.FeatureCollection);
        if (markersRes.ok) {
          const body = (await markersRes.json()) as { items?: CampusMapMarker[] };
          setMarkers(body.items ?? []);
        }
        if (overlayRes.ok) {
          const body = (await overlayRes.json()) as GeoJSON.FeatureCollection;
          if (body?.type === "FeatureCollection") setOverlay(body);
        }
      } catch {
        /* keep client-side config + empty buildings */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusCode, campusName]);

  useEffect(() => {
    if (!agencyId) return;
    let cancelled = false;
    void fetchVenueCameraRegistry(agencyId, "campus")
      .then((rows) => {
        if (!cancelled) setRegistryCameras(rows);
      })
      .catch(() => {
        if (!cancelled) setRegistryCameras([]);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  const merged = useMemo(() => {
    const withStatus = geojson ? mergeCampusBuildingStatus(geojson, buildings) : null;
    return mergeCampusMapPolygons(withStatus, overlay);
  }, [geojson, overlay, buildings]);

  const overlays = useMemo(() => {
    const osm = markers.map(markerToOverlay).filter((row): row is RCOperationalOverlay => Boolean(row));
    const cameras = campusCameraMapMarkers(registryCameras, geojson)
      .map(markerToOverlay)
      .filter((row): row is RCOperationalOverlay => Boolean(row));
    const gis = overlayPointMarkers(overlay)
      .map(markerToOverlay)
      .filter((row): row is RCOperationalOverlay => Boolean(row));
    return [...osm, ...cameras, ...gis];
  }, [markers, registryCameras, geojson, overlay]);

  const issueCommand = useCallback((next: RCMapCommandBody) => {
    setCommand({ ...next, id: Date.now() });
  }, []);

  const pitch = config && is3d ? config.pitch : 0;
  const bearing = config?.bearing ?? 0;
  const center = config?.center ?? [-84.387982, 33.748995];
  const zoom = config?.zoom ?? 15;

  return (
    <div className="relative h-full min-h-0" style={{ height }}>
      <div className="pointer-events-none absolute left-3 top-2 z-20">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{campusName}</div>
        <div className="text-[10px] text-slate-500">
          {config?.hasOsmCoverage ? "OSM building footprints — heights from floor count" : "Campus map"}
          {registryCameras.length ? " · mapped cameras" : ""}
          {overlay?.features.length ? " · GIS overlay" : ""}
        </div>
      </div>
      <button
        type="button"
        title={is3d ? "Switch to 2D" : "Switch to 3D"}
        aria-pressed={is3d}
        className="absolute left-3 top-11 z-20 rounded border p-1.5 text-slate-300 hover:border-orange-500/60"
        style={{ borderColor: C.border, background: C.surface }}
        onClick={() => {
          const next = !is3d;
          setIs3d(next);
          issueCommand({
            type: "camera",
            pitch: next ? (config?.pitch ?? 45) : 0,
            bearing,
            center,
            zoom,
          });
        }}
      >
        <Box size={14} />
      </button>
      {selectedBuilding ? (
        <div
          className="absolute bottom-3 left-3 z-20 flex max-w-[70%] items-center gap-2 rounded border px-2 py-1 text-[11px] text-slate-200"
          style={{ borderColor: C.border, background: C.card }}
        >
          <Building2 size={12} />
          <span>{selectedBuilding}</span>
        </div>
      ) : null}
      <RapidCortexMap
        theme={theme}
        onThemeChange={onThemeChange}
        persistUserId={persistUserId}
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        onIncidentClick={onIncidentClick}
        operationalOverlays={overlays}
        mapCommand={command}
        showZoomControl
        showLayerControl
        vertical="campus"
        height="100%"
        centerLng={center[0]}
        centerLat={center[1]}
        zoom={zoom}
        pitch={pitch}
        bearing={bearing}
        sectionPolygons={merged}
        sectionExtrusion={is3d && Boolean(merged?.features.length)}
        onPolygonFeatureClick={(properties) => {
          const label = String(properties?.label ?? properties?.buildingId ?? "");
          setSelectedBuilding(label || null);
        }}
        defaultLayers={{
          campusZones: !merged?.features.length,
          agencyZones: false,
          counties: false,
          activeIncidents: true,
        }}
      />
    </div>
  );
}
