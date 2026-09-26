"use client";

/**
 * NexCort iQ — Map Core Component
 *
 * NEVER import this file directly in pages or server components.
 * It is loaded exclusively via Next.js dynamic import with ssr: false
 * from RapidCortexMap.tsx to prevent SSR crashes from MapLibre GL's
 * reliance on browser globals (window, navigator, WebGL).
 *
 * Architecture:
 *   RapidCortexMap.tsx  →  dynamic(() => import('./RapidCortexMapCore'))
 *                                              ↑
 *                                       This file
 */

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { alsMapStyleUrl, getMapAuthenticationOptions, isAlsMapApiV2 } from "rapid-cortex-maps";
import { useALSMap } from "@/lib/map/als-map-context";

import {
  CALLER_LABEL_LAYER,
  CALLER_LAYER,
  CALLER_SOURCE_ID,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  FLY_DURATION_MS,
  INCIDENT_ZOOM,
  LIVE_ACTIVE_LAYER,
  LIVE_PULSE_LAYER,
  LIVE_RESOLVED_LAYER,
  LIVE_SOURCE_ID,
  MAP_TOKENS as T,
  OPS_LABEL_LAYER,
  OPS_LAYER,
  OPS_SOURCE_ID,
  SECTION_EXTRUSION_LAYER,
  SECTION_FILL_LAYER,
  SECTION_LABEL_LAYER,
  SECTION_LINE_LAYER,
  SECTION_SOURCE_ID,
  SECTION_STATUS_COLOR_EXPRESSION,
  STUDIO_LAYER_GROUPS,
  STUDIO_LAYER_IDS,
} from "./map-constants";
import type {
  RCCallerLocation,
  RCIncident,
  RCLiveCaller,
  RCMapLayerVisibility,
  RCMapProps,
  RCOperationalOverlay,
} from "./map-types";
import { DEFAULT_LAYER_VISIBILITY } from "./map-types";
import { buildCallerPopupHTML, buildIncidentPopupHTML, incidentsToGeoJSON } from "./map-utils";
import { MapLayerControl } from "./MapLayerControl";
import { collectLiveCallers, isLiveCallerSource } from "@/lib/live-caller";
import {
  applyLiveCallerOverlayVisibility,
  bindLiveCallerOverlayInteractions,
  LIVE_CALLER_LAYER_IDS,
  restoreLiveCallerOverlay,
  setLiveCallerOverlayData,
} from "./live-caller-overlay";
import {
  ensureIncidentPulseImage,
  INCIDENT_PULSE_IMAGE_ID,
} from "./incident-marker-overlay";
import {
  applyRuntimeOverlayVisibility,
  applyTrafficLayerVisibility,
  ensureRuntimeOverlayLayers,
  setOverlaySourceData,
} from "./map-overlay-layers";
import { addOverlayLayer, firstSymbolFont, promoteOverlaySlots, tryAddOverlayLayer } from "./overlay-slot";
import {
  discoverTrafficLayerIds,
  EMPTY_OVERLAY_FC,
  loadAgencyZoneOverlay,
  loadAirportOverlay,
  loadStaticOverlay,
  lngLatBoundsOfIncidents,
  overlayZonesEnabled,
  OVERLAY_AIRPORTS_CIRCLE,
  OVERLAY_AIRPORTS_LABEL,
  OVERLAY_AIRPORTS_SOURCE,
  OVERLAY_COUNTIES_LINE,
  OVERLAY_COUNTIES_SOURCE,
  OVERLAY_STATES_LINE,
  OVERLAY_STATES_SOURCE,
  OVERLAY_ZONES_FILL,
  OVERLAY_ZONES_LINE,
  OVERLAY_ZONES_SOURCE,
} from "./runtime-overlays";
import {
  applyPsapOverlayVisibility,
  bindPsapOverlayInteractions,
  ensurePsapOverlayLayers,
  loadPsapOverlay,
  PSAP_OVERLAY_LAYER_IDS,
  setPsapOverlayData,
} from "./psap-overlay";
import {
  applyHospitalOverlayVisibility,
  bindHospitalOverlayInteractions,
  ensureHospitalOverlayLayers,
  HOSPITAL_OVERLAY_LAYER_IDS,
  loadHospitalOverlay,
  radiusMetersFromMap,
  setHospitalOverlayData,
  visibleHospitalCollection,
  type HospitalSelectHandler,
} from "./hospital-overlay";
import { HospitalDetailCard } from "./HospitalDetailCard";
import { EducationDetailCard } from "./EducationDetailCard";
import {
  applyEducationOverlayVisibility,
  bindEducationOverlayInteractions,
  EDUCATION_FETCH_DEBOUNCE_MS,
  EDUCATION_ERROR_BACKOFF_MS,
  EDUCATION_OVERLAY_LAYER_IDS,
  EDUCATION_ZOOM_HINT,
  ensureEducationOverlayLayers,
  isEducationFetchInBackoff,
  lastEducationOverlayData,
  loadEducationOverlay,
  setEducationOverlayData,
  shouldFetchEducationLayer,
  teardownEducationOverlay,
  type EducationOverlayHint,
  type EducationSelectHandler,
} from "./education-overlay";
import type {
  AlsHospitalFeatureProperties,
  AlsHospitalMapFeatureCollection,
  EducationGeoJsonProperties,
} from "rapid-cortex-shared";
import { isMapEducationEnabled, isMapHospitalsEnabled } from "@/lib/runtime-flags";
import {
  loadMapLayers,
  loadMapTheme,
  saveMapLayers,
  saveMapTheme,
} from "@/lib/maps/persisted-map-prefs";

type MapClickHandler = (
  e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
) => void;

const EMPTY_SECTION_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

async function restorePsapOverlay(map: maplibregl.Map, visible: boolean): Promise<void> {
  await ensurePsapOverlayLayers(map);
  bindPsapOverlayInteractions(map, maplibregl);
  applyPsapOverlayVisibility(map, visible);
  if (visible) {
    setPsapOverlayData(map, await loadPsapOverlay());
  }
}

async function restoreHospitalOverlay(
  map: maplibregl.Map,
  layers: RCMapLayerVisibility,
  onSelect: HospitalSelectHandler,
): Promise<void> {
  if (!isMapHospitalsEnabled()) return;
  await ensureHospitalOverlayLayers(map);
  bindHospitalOverlayInteractions(map, maplibregl, onSelect);
  applyHospitalOverlayVisibility(map, layers.hospitals || layers.emergencyRooms);
}

async function restoreEducationOverlay(
  map: maplibregl.Map,
  layers: RCMapLayerVisibility,
  onSelect: EducationSelectHandler,
): Promise<void> {
  if (!isMapEducationEnabled()) return;
  await ensureEducationOverlayLayers(map);
  bindEducationOverlayInteractions(map, maplibregl, onSelect);
  applyEducationOverlayVisibility(map, layers.education);
  if (layers.education) {
    setEducationOverlayData(map, lastEducationOverlayData(map));
  }
}

function restoreLiveCallerLayers(
  map: maplibregl.Map,
  layers: RCMapLayerVisibility,
  callers: RCLiveCaller[],
  onSelect: (caller: RCLiveCaller) => void,
): void {
  restoreLiveCallerOverlay(map, layers, callers);
  bindLiveCallerOverlayInteractions(map, maplibregl, onSelect);
}

function hospitalDistanceOrigin(
  caller: RCCallerLocation | null | undefined,
  incidents: RCIncident[],
  selectedId: string | null | undefined,
): { lat: number; lng: number } | undefined {
  if (caller) return { lat: caller.lat, lng: caller.lng };
  const selected = incidents.find(
    (item) => item.id === selectedId && item.latitude != null && item.longitude != null,
  );
  if (selected?.latitude != null && selected.longitude != null) {
    return { lat: selected.latitude, lng: selected.longitude };
  }
  const first = incidents.find((item) => item.latitude != null && item.longitude != null);
  if (first?.latitude != null && first.longitude != null) {
    return { lat: first.latitude, lng: first.longitude };
  }
  return undefined;
}

function styleUrlFor(theme: "dark" | "light", layers: RCMapLayerVisibility): string {
  if (!isAlsMapApiV2()) return alsMapStyleUrl(theme);
  return alsMapStyleUrl(theme, {
    traffic: layers.liveTraffic,
    terrain: layers.basemapTerrain,
    buildings: layers.basemapBuildings,
    contours: layers.basemapContours,
    travelMode: layers.basemapTransit ? "Transit" : undefined,
    style: layers.basemapSatellite ? "Hybrid" : undefined,
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RapidCortexMapCore({
  centerLng,
  centerLat,
  zoom,
  incidents = [],
  selectedIncidentId,
  onIncidentClick,
  onMapReady,
  callerLocation,
  liveCallers = [],
  onLiveCallerClick,
  defaultLayers,
  showLayerControl = true,
  height = "100%",
  className,
  vertical = "core",
  theme: themeProp = "dark",
  onThemeChange,
  persistUserId,
  operationalOverlays = [],
  onOverlayClick,
  mapCommand,
  showZoomControl = true,
  pitch: pitchProp = 0,
  bearing: bearingProp = 0,
  sectionPolygons = null,
  sectionExtrusion = false,
  onPolygonFeatureClick,
}: RCMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const popupRef     = useRef<maplibregl.Popup | null>(null);
  const layersRef    = useRef<RCMapLayerVisibility>({
    ...DEFAULT_LAYER_VISIBILITY,
    ...defaultLayers,
  });
  const incidentsRef = useRef<RCIncident[]>(incidents);
  const overlaysRef = useRef<RCOperationalOverlay[]>(operationalOverlays);
  const overlayClickRef = useRef(onOverlayClick);
  const polygonClickRef = useRef(onPolygonFeatureClick);
  const sectionsRef = useRef<GeoJSON.FeatureCollection>(sectionPolygons ?? EMPTY_SECTION_FC);
  const extrusionRef = useRef(sectionExtrusion);
  const pitchRef = useRef(pitchProp);
  const bearingRef = useRef(bearingProp);
  const appliedThemeRef = useRef<"dark" | "light" | null>(null);
  const appliedStyleUrlRef = useRef<string | null>(null);
  const styleLoadHandlerRef = useRef<(() => void) | null>(null);
  const clickHandlerRef = useRef<MapClickHandler>(() => undefined);
  const lastCommandIdRef = useRef<number | null>(null);
  const trafficLayersRef = useRef<{ flow: string[]; closures: string[] }>({ flow: [], closures: [] });
  const didFitRef = useRef(false);
  const hospitalDataRef = useRef<AlsHospitalMapFeatureCollection>({
    type: "FeatureCollection",
    features: [],
  });
  const hospitalSelectRef = useRef<HospitalSelectHandler>(() => undefined);
  const educationSelectRef = useRef<EducationSelectHandler>(() => undefined);
  const educationAbortRef = useRef<AbortController | null>(null);
  const educationErrorUntilRef = useRef(0);
  const selectedIncidentIdRef = useRef(selectedIncidentId);
  const liveCallersRef = useRef<RCLiveCaller[]>(liveCallers ?? []);
  const callerLocationRef = useRef<RCCallerLocation | null | undefined>(callerLocation);
  const liveCallerClickRef = useRef(onLiveCallerClick);
  const incidentClickRef = useRef(onIncidentClick);
  const liveCallerSeenAtRef = useRef(new Map<string, { coordKey: string; at: string }>());
  const [selectedHospital, setSelectedHospital] = useState<{
    props: AlsHospitalFeatureProperties;
    coordinates: [number, number];
  } | null>(null);
  const [selectedEducation, setSelectedEducation] = useState<{
    props: EducationGeoJsonProperties;
    coordinates: [number, number];
  } | null>(null);
  const [educationHint, setEducationHint] = useState<EducationOverlayHint>(null);

  const [mapReady,  setMapReady]  = useState(false);
  const [mapError,  setMapError]  = useState<string | null>(null);
  const [localTheme, setLocalTheme] = useState<"dark" | "light">(themeProp);
  const [layers, setLayers]       = useState<RCMapLayerVisibility>({
    ...DEFAULT_LAYER_VISIBILITY,
    ...defaultLayers,
  });

  const theme = onThemeChange ? themeProp : localTheme;
  const { ready: alsReady } = useALSMap();

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  hospitalSelectRef.current = (props, coordinates) => {
    setSelectedEducation(null);
    setSelectedHospital({ props, coordinates });
  };

  educationSelectRef.current = (props, coordinates) => {
    setSelectedHospital(null);
    setSelectedEducation({ props, coordinates });
  };

  liveCallerClickRef.current = onLiveCallerClick;
  incidentClickRef.current = onIncidentClick;
  liveCallersRef.current = liveCallers ?? [];
  callerLocationRef.current = callerLocation;
  selectedIncidentIdRef.current = selectedIncidentId;

  const fallbackLiveCallerUpdatedAt = (id: string, coordKey: string): string => {
    const existing = liveCallerSeenAtRef.current.get(id);
    if (existing && existing.coordKey === coordKey) return existing.at;
    const at = new Date().toISOString();
    liveCallerSeenAtRef.current.set(id, { coordKey, at });
    return at;
  };

  const resolvedLiveCallers = (): RCLiveCaller[] =>
    collectLiveCallers(liveCallersRef.current, callerLocationRef.current, fallbackLiveCallerUpdatedAt);

  const onLiveCallerSelect = (caller: RCLiveCaller) => {
    liveCallerClickRef.current?.(caller);
    if (!caller.incidentId) return;
    const matched = incidentsRef.current.find((item) => item.id === caller.incidentId);
    if (matched) incidentClickRef.current?.(matched);
  };

  useEffect(() => {
    incidentsRef.current = incidents;
  }, [incidents]);

  useEffect(() => {
    overlaysRef.current = operationalOverlays;
  }, [operationalOverlays]);

  useEffect(() => {
    overlayClickRef.current = onOverlayClick;
  }, [onOverlayClick]);

  useEffect(() => {
    polygonClickRef.current = onPolygonFeatureClick;
  }, [onPolygonFeatureClick]);

  useEffect(() => {
    sectionsRef.current = sectionPolygons ?? EMPTY_SECTION_FC;
  }, [sectionPolygons]);

  useEffect(() => {
    extrusionRef.current = sectionExtrusion;
  }, [sectionExtrusion]);

  useEffect(() => {
    pitchRef.current = pitchProp;
    bearingRef.current = bearingProp;
  }, [pitchProp, bearingProp]);

  useEffect(() => {
    if (onThemeChange) setLocalTheme(themeProp);
  }, [themeProp, onThemeChange]);

  // Hydrate per-user layer (and uncontrolled theme) prefs after mount / user change.
  useEffect(() => {
    if (!persistUserId) return;
    const stored = loadMapLayers(persistUserId, vertical, defaultLayers);
    setLayers(stored);
    layersRef.current = stored;
    if (!onThemeChange) {
      setLocalTheme(loadMapTheme(persistUserId, vertical, themeProp));
    }
  }, [persistUserId, vertical]); // eslint-disable-line react-hooks/exhaustive-deps — hydrate once per user/vertical

  // ─── Initialize map (runs once) ─────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || !alsReady) return;

    const initialTheme = themeProp;
    appliedThemeRef.current = initialTheme;
    const initialStyle = styleUrlFor(initialTheme, layersRef.current);
    appliedStyleUrlRef.current = initialStyle;

    const initCenter: [number, number] = [
      centerLng ?? DEFAULT_CENTER[0],
      centerLat ?? DEFAULT_CENTER[1],
    ];
    const initZoom = zoom ?? DEFAULT_ZOOM;

    const map = new maplibregl.Map({
      container:          containerRef.current,
      style:              initialStyle,
      center:             initCenter,
      zoom:               initZoom,
      pitch:              pitchProp,
      bearing:            bearingProp,
      maxPitch:           60,
      attributionControl: {},
      trackResize:        true,
      ...getMapAuthenticationOptions(),
    });

    mapRef.current = map;

    // Controls
    if (showZoomControl) {
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );
    }

    const onIncidentLayerClick: MapClickHandler = (e) => {
      clickHandlerRef.current(e);
    };

    // ── After style loads ────────────────────────────────────────────────────
    map.on("load", () => {
      ensureLiveLayers(
        map,
        layersRef.current,
        incidentsRef.current,
        overlaysRef.current,
        sectionsRef.current,
        extrusionRef.current,
      );
      ensureRuntimeOverlayLayers(map);
      void restorePsapOverlay(map, layersRef.current.psaps);
      void restoreHospitalOverlay(map, layersRef.current, (props, coordinates) => {
        hospitalSelectRef.current(props, coordinates);
      });
      void restoreEducationOverlay(map, layersRef.current, (props, coordinates) => {
        educationSelectRef.current(props, coordinates);
      });
      restoreLiveCallerLayers(map, layersRef.current, resolvedLiveCallers(), onLiveCallerSelect);
      trafficLayersRef.current = discoverTrafficLayerIds(map.getStyle()?.layers);
      promoteStudioOverlays(map);
      applyStudioVisibility(map, layersRef.current);
      applyRuntimeOverlayVisibility(map, layersRef.current);
      applyTrafficLayerVisibility(
        map,
        trafficLayersRef.current.flow,
        trafficLayersRef.current.closures,
        layersRef.current,
      );
      bindIncidentInteractions(map, onIncidentLayerClick);
      bindOverlayInteractions(map, (id) => {
        const overlay = overlaysRef.current.find((item) => item.id === id);
        if (overlay) overlayClickRef.current?.(overlay);
      });
      bindPolygonInteractions(map, (props) => polygonClickRef.current?.(props));
      // ALS style-descriptor center/zoom can overwrite constructor camera.
      map.jumpTo({
        center: initCenter,
        zoom: initZoom,
        pitch: pitchRef.current,
        bearing: bearingRef.current,
      });
      didFitRef.current = fitMapToIncidents(
        map,
        incidentsRef.current,
        pitchRef.current,
        bearingRef.current,
        initZoom,
      );
      map.resize();
      setMapReady(true);
      onMapReady?.();
    });

    // Handle style load errors
    map.on("error", (e) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[RapidCortexMap] MapLibre error:", e);
      }
    });

    let resizeRaf = 0;
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (resizeRaf) cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(() => {
              resizeRaf = 0;
              mapRef.current?.resize();
            });
          })
        : null;
    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeObserver?.disconnect();
      popupRef.current?.remove();
      educationAbortRef.current?.abort();
      teardownEducationOverlay(map);
      map.remove();
      mapRef.current = null;
      didFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alsReady]); // Wait for ALS auth, then mount once

  // ─── Swap ALS style when theme or V2 basemap options change ─────────────
  // Do not wait on mapReady — a second toggle during reload must still apply.

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = styleUrlFor(theme, layers);
    if (appliedStyleUrlRef.current === nextStyle) return;

    if (styleLoadHandlerRef.current) {
      map.off("style.load", styleLoadHandlerRef.current);
      styleLoadHandlerRef.current = null;
    }

    appliedThemeRef.current = theme;
    appliedStyleUrlRef.current = nextStyle;
    setMapReady(false);
    popupRef.current?.remove();

    const onStyleLoad = () => {
      styleLoadHandlerRef.current = null;
      ensureLiveLayers(
        map,
        layersRef.current,
        incidentsRef.current,
        overlaysRef.current,
        sectionsRef.current,
        extrusionRef.current,
      );
      ensureRuntimeOverlayLayers(map);
      void restorePsapOverlay(map, layersRef.current.psaps);
      void restoreHospitalOverlay(map, layersRef.current, (props, coordinates) => {
        hospitalSelectRef.current(props, coordinates);
      });
      void restoreEducationOverlay(map, layersRef.current, (props, coordinates) => {
        educationSelectRef.current(props, coordinates);
      });
      restoreLiveCallerLayers(map, layersRef.current, resolvedLiveCallers(), onLiveCallerSelect);
      trafficLayersRef.current = discoverTrafficLayerIds(map.getStyle()?.layers);
      promoteStudioOverlays(map);
      applyStudioVisibility(map, layersRef.current);
      applyRuntimeOverlayVisibility(map, layersRef.current);
      applyTrafficLayerVisibility(
        map,
        trafficLayersRef.current.flow,
        trafficLayersRef.current.closures,
        layersRef.current,
      );
      bindIncidentInteractions(map, (e) => clickHandlerRef.current(e));
      bindOverlayInteractions(map, (id) => {
        const overlay = overlaysRef.current.find((item) => item.id === id);
        if (overlay) overlayClickRef.current?.(overlay);
      });
      bindPolygonInteractions(map, (props) => polygonClickRef.current?.(props));
      map.resize();
      setMapReady(true);
    };

    styleLoadHandlerRef.current = onStyleLoad;
    map.once("style.load", onStyleLoad);
    map.setStyle(nextStyle);
  }, [
    theme,
    layers.liveTraffic,
    layers.basemapTerrain,
    layers.basemapBuildings,
    layers.basemapContours,
    layers.basemapTransit,
    layers.basemapSatellite,
  ]);

  // ─── Update live incidents when prop changes ─────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(LIVE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(incidentsToGeoJSON(incidents));
  }, [incidents, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(OPS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(overlaysToGeoJSON(operationalOverlays));
  }, [operationalOverlays, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(SECTION_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(sectionPolygons ?? EMPTY_SECTION_FC);
    applySectionLayerVisibility(mapRef.current, sectionPolygons, sectionExtrusion);
  }, [sectionPolygons, sectionExtrusion, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !mapCommand) return;
    if (lastCommandIdRef.current === mapCommand.id) return;
    lastCommandIdRef.current = mapCommand.id;
    if (mapCommand.type === "zoom-in") {
      map.zoomIn({ duration: 240 });
      return;
    }
    if (mapCommand.type === "zoom-out") {
      map.zoomOut({ duration: 240 });
      return;
    }
    if (mapCommand.type === "fit") {
      const pitch = mapCommand.pitch ?? pitchRef.current;
      const bearing = mapCommand.bearing ?? bearingRef.current;
      if (mapCommand.bounds) {
        map.fitBounds(mapCommand.bounds, {
          padding: 48,
          duration: 400,
          maxZoom: 17,
          pitch,
          bearing,
        });
        return;
      }
      if (mapCommand.center) {
        map.flyTo({
          center: mapCommand.center,
          zoom: mapCommand.zoom ?? INCIDENT_ZOOM,
          pitch,
          bearing,
          duration: 400,
          essential: true,
        });
      }
      return;
    }
    if (mapCommand.type === "camera") {
      map.easeTo({
        ...(mapCommand.center ? { center: mapCommand.center } : {}),
        ...(mapCommand.zoom !== undefined ? { zoom: mapCommand.zoom } : {}),
        ...(mapCommand.pitch !== undefined ? { pitch: mapCommand.pitch } : {}),
        ...(mapCommand.bearing !== undefined ? { bearing: mapCommand.bearing } : {}),
        duration: 500,
        essential: true,
      });
    }
  }, [mapCommand, mapReady]);

  // ─── Fly to selected incident ────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedIncidentId) return;
    const incident = incidents.find((i) => i.id === selectedIncidentId);
    if (!incident?.latitude || !incident?.longitude) return;

    mapRef.current.flyTo({
      center:    [incident.longitude, incident.latitude],
      zoom:      INCIDENT_ZOOM,
      pitch:     pitchRef.current,
      bearing:   bearingRef.current,
      duration:  FLY_DURATION_MS,
      essential: true,
    });

    // Open popup for the selected incident
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({
      closeButton:  true,
      closeOnClick: true,
      maxWidth:     "260px",
      className:    "rc-map-popup",
    })
      .setLngLat([incident.longitude, incident.latitude])
      .setHTML(
        buildIncidentPopupHTML({
          id:            incident.id,
          severity:      incident.severity,
          type:          incident.type,
          status:        incident.status,
          locationLabel: incident.locationLabel,
          createdAt:     incident.createdAt,
          description:   incident.description,
        })
      )
      .addTo(mapRef.current);
  }, [selectedIncidentId, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update caller location ──────────────────────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(CALLER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    const reportPin = callerLocation && !isLiveCallerSource(callerLocation.source) ? callerLocation : null;

    if (!reportPin) {
      source?.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    source?.setData({
      type:     "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type:        "Point",
            coordinates: [reportPin.lng, reportPin.lat],
          },
          properties: {
            label:  reportPin.label ?? "Caller Location",
            source: reportPin.source ?? "reported",
          },
        },
      ],
    });
  }, [callerLocation, mapReady]);

  // ─── Live caller GPS overlay (pulse + accuracy + freshness) ─────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const paint = () => {
      setLiveCallerOverlayData(map, resolvedLiveCallers());
      applyLiveCallerOverlayVisibility(map, layersRef.current);
    };
    paint();
    const timer = window.setInterval(paint, 1000);
    return () => window.clearInterval(timer);
  }, [mapReady, liveCallers, callerLocation]);

  // ─── Sync layer visibility when state changes ────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    applyStudioVisibility(map, layers);

    // App-managed layers
    safeSetVisibility(map, LIVE_ACTIVE_LAYER,   layers.activeIncidents);
    safeSetVisibility(map, LIVE_PULSE_LAYER,    layers.activeIncidents);
    safeSetVisibility(map, LIVE_RESOLVED_LAYER, layers.resolvedIncidents);
    safeSetVisibility(map, CALLER_LAYER,        layers.callerPin);
    safeSetVisibility(map, CALLER_LABEL_LAYER,  layers.callerPin);
    applyRuntimeOverlayVisibility(map, layers);
    applyPsapOverlayVisibility(map, layers.psaps);
    applyHospitalOverlayVisibility(map, layers.hospitals || layers.emergencyRooms);
    applyEducationOverlayVisibility(map, layers.education);
    applyLiveCallerOverlayVisibility(map, layers);
    applyTrafficLayerVisibility(
      map,
      trafficLayersRef.current.flow,
      trafficLayersRef.current.closures,
      layers,
    );
  }, [layers, mapReady]);

  // Fetch GeoJSON for layer toggles that ALS Esri/HERE styles do not include.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    let cancelled = false;
    void (async () => {
      if (layers.counties) {
        const data = await loadStaticOverlay("counties");
        if (!cancelled) setOverlaySourceData(map, OVERLAY_COUNTIES_SOURCE, data);
      }
      if (layers.stateBoundaries) {
        const data = await loadStaticOverlay("states");
        if (!cancelled) setOverlaySourceData(map, OVERLAY_STATES_SOURCE, data);
      }
      if (layers.airports) {
        if (!cancelled) setOverlaySourceData(map, OVERLAY_AIRPORTS_SOURCE, loadAirportOverlay());
      }
      if (overlayZonesEnabled(layers)) {
        const data = await loadAgencyZoneOverlay();
        if (!cancelled) setOverlaySourceData(map, OVERLAY_ZONES_SOURCE, data);
      }
      if (layers.psaps) {
        const data = await loadPsapOverlay();
        if (!cancelled) setPsapOverlayData(map, data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    layers.counties,
    layers.stateBoundaries,
    layers.airports,
    layers.agencyZones,
    layers.campusZones,
    layers.venueZones,
    layers.psaps,
  ]);

  const hospitalOverlayOn = layers.hospitals || layers.emergencyRooms;

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    applyHospitalOverlayVisibility(map, hospitalOverlayOn);
    if (!hospitalOverlayOn) {
      setHospitalOverlayData(map, EMPTY_OVERLAY_FC);
      setSelectedHospital(null);
      return;
    }
    setHospitalOverlayData(
      map,
      visibleHospitalCollection(hospitalDataRef.current, {
        hospitals: layers.hospitals,
        emergencyRooms: layers.emergencyRooms,
      }),
    );
  }, [mapReady, hospitalOverlayOn, layers.hospitals, layers.emergencyRooms]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !isMapHospitalsEnabled() || !hospitalOverlayOn) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      const center = map.getCenter();
      const origin = hospitalDistanceOrigin(
        callerLocation,
        incidentsRef.current,
        selectedIncidentId,
      );
      const data = await loadHospitalOverlay({
        lat: center.lat,
        lng: center.lng,
        radius: radiusMetersFromMap(map),
        fromLat: origin?.lat,
        fromLng: origin?.lng,
      });
      if (cancelled) return;
      hospitalDataRef.current = data;
      setHospitalOverlayData(
        map,
        visibleHospitalCollection(data, {
          hospitals: layersRef.current.hospitals,
          emergencyRooms: layersRef.current.emergencyRooms,
        }),
      );
    };

    void (async () => {
      await ensureHospitalOverlayLayers(map);
      bindHospitalOverlayInteractions(map, maplibregl, (props, coordinates) => {
        hospitalSelectRef.current(props, coordinates);
      });
      await refresh();
    })();

    const onMoveEnd = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh();
      }, 400);
    };
    map.on("moveend", onMoveEnd);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      map.off("moveend", onMoveEnd);
    };
  }, [mapReady, hospitalOverlayOn, callerLocation, selectedIncidentId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    applyEducationOverlayVisibility(map, layers.education);
    if (!layers.education) {
      setEducationOverlayData(map, EMPTY_OVERLAY_FC);
      setSelectedEducation(null);
      setEducationHint(null);
      educationErrorUntilRef.current = 0;
    }
  }, [mapReady, layers.education]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !isMapEducationEnabled() || !layers.education) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = async () => {
      if (!shouldFetchEducationLayer(map.getZoom())) {
        educationAbortRef.current?.abort();
        setEducationOverlayData(map, EMPTY_OVERLAY_FC);
        setEducationHint("zoom");
        return;
      }
      if (isEducationFetchInBackoff(educationErrorUntilRef.current)) {
        return;
      }
      educationAbortRef.current?.abort();
      const controller = new AbortController();
      educationAbortRef.current = controller;
      const center = map.getCenter();
      const bounds = map.getBounds();
      const origin = hospitalDistanceOrigin(
        callerLocationRef.current,
        incidentsRef.current,
        selectedIncidentIdRef.current,
      );
      const result = await loadEducationOverlay(
        {
          centerLat: center.lat,
          centerLng: center.lng,
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
          zoom: map.getZoom(),
          fromLat: origin?.lat,
          fromLng: origin?.lng,
        },
        controller.signal,
      );
      if (cancelled || controller.signal.aborted) return;
      if (!result.ok) {
        if (!result.aborted) {
          educationErrorUntilRef.current = Date.now() + EDUCATION_ERROR_BACKOFF_MS;
        }
        return;
      }
      educationErrorUntilRef.current = 0;
      setEducationHint(null);
      setEducationOverlayData(map, result.data);
    };

    void (async () => {
      await ensureEducationOverlayLayers(map);
      bindEducationOverlayInteractions(map, maplibregl, (props, coordinates) => {
        educationSelectRef.current(props, coordinates);
      });
      applyEducationOverlayVisibility(map, true);
      await refresh();
    })();

    const onMoveEnd = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh();
      }, EDUCATION_FETCH_DEBOUNCE_MS);
    };
    map.on("moveend", onMoveEnd);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      educationAbortRef.current?.abort();
      map.off("moveend", onMoveEnd);
    };
  }, [mapReady, layers.education]);

  // Fit once when the first geocoded incidents arrive after style load.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || didFitRef.current) return;
    const fitted = fitMapToIncidents(
      map,
      incidents,
      pitchRef.current,
      bearingRef.current,
      zoom ?? DEFAULT_ZOOM,
    );
    if (fitted) didFitRef.current = true;
  }, [incidents, mapReady, zoom]);

  // ─── Layer toggle handler (passed to MapLayerControl) ────────────────────

  const handleLayerToggle = useCallback(
    (key: keyof RCMapLayerVisibility, value: boolean) => {
      setLayers((prev) => {
        const next = { ...prev, [key]: value };
        saveMapLayers(persistUserId, vertical, next);
        return next;
      });
    },
    [persistUserId, vertical]
  );

  // ─── Incident click (kept current via ref for map listeners) ─────────────

  clickHandlerRef.current = (e) => {
    if (!e.features?.[0] || !mapRef.current) return;

    const props = e.features[0].properties as {
      id:            string;
      status:        string;
      severity:      string;
      type:          string;
      locationLabel: string;
      createdAt:     string;
      description:   string;
    };

    const geometry = e.features[0].geometry as GeoJSON.Point;
    const [lng, lat] = geometry.coordinates;

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({
      closeButton:  true,
      closeOnClick: true,
      maxWidth:     "260px",
    })
      .setLngLat([lng, lat])
      .setHTML(buildIncidentPopupHTML(props))
      .addTo(mapRef.current);

    const matched = incidents.find((i) => i.id === props.id);
    if (matched) {
      onIncidentClick?.(matched);
    }
  };

  const handleThemeToggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setLocalTheme(next);
    saveMapTheme(persistUserId, vertical, next);
    onThemeChange?.(next);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (mapError) {
    return (
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          height:         height,
          background:     T.surface,
          border:         `1px solid ${T.border}`,
          borderRadius:   8,
          padding:        24,
          color:          T.textMuted,
          fontSize:       12,
          textAlign:      "center",
          whiteSpace:     "pre-wrap",
        }}
      >
        {mapError}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width:    "100%",
        height:   height,
        overflow: "hidden",
        borderRadius: 8,
      }}
    >
      {/* Map container */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset:    0,
        }}
      />

      {/* Layer control */}
      {showLayerControl && mapReady && (
        <MapLayerControl
          layers={layers}
          onToggle={handleLayerToggle}
          vertical={vertical}
        />
      )}

      {selectedHospital && (
        <HospitalDetailCard
          props={selectedHospital.props}
          coordinates={selectedHospital.coordinates}
          onClose={() => setSelectedHospital(null)}
        />
      )}

      {selectedEducation && (
        <EducationDetailCard
          props={selectedEducation.props}
          coordinates={selectedEducation.coordinates}
          onClose={() => setSelectedEducation(null)}
          onCenter={() => {
            mapRef.current?.easeTo({
              center: selectedEducation.coordinates,
              zoom: Math.max(mapRef.current.getZoom(), 14),
            });
          }}
        />
      )}

      {educationHint === "zoom" && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 12,
            zIndex: 11,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "6px 10px",
            color: T.textMuted,
            fontSize: 11,
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,.35)",
            maxWidth: 280,
          }}
        >
          {EDUCATION_ZOOM_HINT}
        </div>
      )}

      {/* Dark / light ALS style toggle — above MapLibre +/- (bottom-right) */}
      {mapReady && (
        <button
          type="button"
          onClick={handleThemeToggle}
          aria-label={theme === "dark" ? "Switch to light map" : "Switch to dark map"}
          style={{
            position:     "absolute",
            bottom:       90,
            right:        12,
            zIndex:       10,
            background:   T.surface,
            border:       `1px solid ${T.border}`,
            borderRadius: 6,
            padding:      "6px 10px",
            cursor:       "pointer",
            color:        T.textMuted,
            fontSize:     11,
            fontWeight:   600,
            lineHeight:   1.2,
            boxShadow:    "0 2px 6px rgba(0,0,0,.35)",
          }}
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      )}

      {/* Loading state overlay */}
      {!mapReady && !mapError && (
        <div
          style={{
            position:       "absolute",
            inset:          0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            background:     T.surface,
            color:          T.textMuted,
            fontSize:       12,
            letterSpacing:  "0.05em",
            fontWeight:     600,
          }}
        >
          <span style={{ animation: "rc-map-pulse 1.4s ease-in-out infinite" }}>
            LOADING MAP…
          </span>
        </div>
      )}

      {/* Inline CSS for popup styles + loading animation */}
      <style>{`
        .maplibregl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .maplibregl-popup-tip {
          display: none !important;
        }
        .maplibregl-popup-close-button {
          color: #5a4d7a !important;
          font-size: 16px !important;
          padding: 4px 8px !important;
          right: 2px !important;
          top: 2px !important;
          background: transparent !important;
        }
        .maplibregl-popup-close-button:hover {
          color: #e4dff5 !important;
          background: transparent !important;
        }
        .maplibregl-ctrl-bottom-right {
          bottom: 8px !important;
          right: 8px !important;
        }
        .maplibregl-ctrl-group {
          background: #100e1a !important;
          border: 1px solid #1e1a30 !important;
          box-shadow: 0 2px 6px rgba(0,0,0,.5) !important;
        }
        .maplibregl-ctrl-group button {
          background-color: #100e1a !important;
          border-color: #1e1a30 !important;
        }
        .maplibregl-ctrl-group button:hover {
          background-color: #1e1a30 !important;
        }
        .maplibregl-ctrl-icon {
          filter: invert(0.7) !important;
        }
        @keyframes rc-map-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fitMapToIncidents(
  map: maplibregl.Map,
  incidents: RCIncident[],
  pitch: number,
  bearing: number,
  fallbackZoom: number,
): boolean {
  const fit = lngLatBoundsOfIncidents(incidents);
  if (!fit) return false;
  if (fit.bounds) {
    map.fitBounds(fit.bounds, {
      padding: 72,
      maxZoom: 13,
      duration: 0,
      pitch,
      bearing,
    });
    return true;
  }
  map.jumpTo({
    center: fit.center,
    zoom: Math.max(fallbackZoom, 12),
    pitch,
    bearing,
  });
  return true;
}

/** Re-add app-managed GeoJSON sources/layers after initial load or setStyle. */
function ensureLiveLayers(
  map: maplibregl.Map,
  layers: RCMapLayerVisibility,
  incidents: RCIncident[],
  overlays: RCOperationalOverlay[] = [],
  sections: GeoJSON.FeatureCollection = EMPTY_SECTION_FC,
  extrude = false,
): void {
  if (!map.getSource(SECTION_SOURCE_ID)) {
    map.addSource(SECTION_SOURCE_ID, {
      type: "geojson",
      data: sections,
    });
  } else {
    (map.getSource(SECTION_SOURCE_ID) as maplibregl.GeoJSONSource).setData(sections);
  }

  if (!map.getLayer(SECTION_FILL_LAYER)) {
    addOverlayLayer(map, {
      id: SECTION_FILL_LAYER,
      type: "fill",
      source: SECTION_SOURCE_ID,
      paint: {
        "fill-color": SECTION_STATUS_COLOR_EXPRESSION,
        "fill-opacity": 0.45,
      },
    });
  }

  if (!map.getLayer(SECTION_EXTRUSION_LAYER)) {
    addOverlayLayer(map, {
      id: SECTION_EXTRUSION_LAYER,
      type: "fill-extrusion",
      source: SECTION_SOURCE_ID,
      paint: {
        "fill-extrusion-color": SECTION_STATUS_COLOR_EXPRESSION,
        "fill-extrusion-height": ["to-number", ["get", "extrusionHeight"]],
        "fill-extrusion-base": ["to-number", ["get", "extrusionBase"]],
        "fill-extrusion-opacity": 0.7,
      },
    });
  }

  if (!map.getLayer(SECTION_LINE_LAYER)) {
    addOverlayLayer(map, {
      id: SECTION_LINE_LAYER,
      type: "line",
      source: SECTION_SOURCE_ID,
      paint: {
        "line-color": SECTION_STATUS_COLOR_EXPRESSION,
        "line-width": 1.5,
        "line-opacity": 0.9,
      },
    });
  }

  if (!map.getLayer(SECTION_LABEL_LAYER)) {
    tryAddOverlayLayer(map, {
      id: SECTION_LABEL_LAYER,
      type: "symbol",
      source: SECTION_SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-font": firstSymbolFont(map),
        "text-anchor": "center",
        "text-max-width": 6,
      },
      paint: {
        "text-color": "#e2e8f0",
        "text-halo-color": "#0f1117",
        "text-halo-width": 1.2,
      },
    });
  }

  applySectionLayerVisibility(map, sections, extrude);

  ensureIncidentPulseImage(map);

  if (!map.getSource(LIVE_SOURCE_ID)) {
    map.addSource(LIVE_SOURCE_ID, {
      type: "geojson",
      data: incidentsToGeoJSON(incidents),
    });
  } else {
    (map.getSource(LIVE_SOURCE_ID) as maplibregl.GeoJSONSource).setData(
      incidentsToGeoJSON(incidents)
    );
  }

  if (!map.getLayer(LIVE_PULSE_LAYER)) {
    addOverlayLayer(map, {
      id:     LIVE_PULSE_LAYER,
      type:   "symbol",
      source: LIVE_SOURCE_ID,
      filter: ["in", ["get", "status"], ["literal", ["active", "responding"]]],
      layout: {
        "icon-image": INCIDENT_PULSE_IMAGE_ID,
        "icon-size": 0.45,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }

  if (!map.getLayer(LIVE_ACTIVE_LAYER)) {
    addOverlayLayer(map, {
      id:     LIVE_ACTIVE_LAYER,
      type:   "circle",
      source: LIVE_SOURCE_ID,
      filter: ["in", ["get", "status"], ["literal", ["active", "responding"]]],
      paint:  {
        "circle-radius": 18,
        "circle-color": "#ef4444",
        "circle-opacity": 0,
      },
    });
  }

  if (!map.getLayer(LIVE_RESOLVED_LAYER)) {
    addOverlayLayer(map, {
      id:     LIVE_RESOLVED_LAYER,
      type:   "circle",
      source: LIVE_SOURCE_ID,
      filter: ["==", ["get", "status"], "resolved"],
      paint:  {
        "circle-radius":       6,
        "circle-color":        "#6b7280",
        "circle-opacity":      0.55,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#9ca3af",
      },
      layout: {
        visibility: layers.resolvedIncidents ? "visible" : "none",
      },
    });
  }

  if (!map.getSource(CALLER_SOURCE_ID)) {
    map.addSource(CALLER_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer(CALLER_LAYER)) {
    addOverlayLayer(map, {
      id:     CALLER_LAYER,
      type:   "circle",
      source: CALLER_SOURCE_ID,
      paint:  {
        "circle-radius":       13,
        "circle-color":        "#0ea5e9",
        "circle-opacity":      0.9,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(CALLER_LABEL_LAYER)) {
    tryAddOverlayLayer(map, {
      id:     CALLER_LABEL_LAYER,
      type:   "symbol",
      source: CALLER_SOURCE_ID,
      layout: {
        "text-field":      ["get", "label"],
        "text-size":       11,
        "text-offset":     [0, 1.8],
        "text-anchor":     "top",
        "text-font":       firstSymbolFont(map),
        "text-max-width":  10,
      },
      paint: {
        "text-color":       "#0ea5e9",
        "text-halo-color":  "#0f0d1c",
        "text-halo-width":  1.5,
      },
    });
  }

  if (!map.getSource(OPS_SOURCE_ID)) {
    map.addSource(OPS_SOURCE_ID, {
      type: "geojson",
      data: overlaysToGeoJSON(overlays),
    });
  } else {
    (map.getSource(OPS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(overlaysToGeoJSON(overlays));
  }

  if (!map.getLayer(OPS_LAYER)) {
    addOverlayLayer(map, {
      id: OPS_LAYER,
      type: "circle",
      source: OPS_SOURCE_ID,
      paint: {
        "circle-radius": 8,
        "circle-color": [
          "match",
          ["get", "kind"],
          "camera", "#3b82f6",
          "entrance", "#22c55e",
          "staging", "#f59e0b",
          "security", "#a78bfa",
          "ems", "#ef4444",
          "police", "#60a5fa",
          "fire", "#f97316",
          "roadClosure", "#fbbf24",
          "aed", "#ef4444",
          "emergencyPhone", "#f87171",
          "parking", "#94a3b8",
          "#94a3b8",
        ],
        "circle-opacity": 0.92,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(OPS_LABEL_LAYER)) {
    tryAddOverlayLayer(map, {
      id: OPS_LABEL_LAYER,
      type: "symbol",
      source: OPS_SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 10,
        "text-offset": [0, 1.4],
        "text-anchor": "top",
        "text-font": firstSymbolFont(map),
        "text-max-width": 8,
      },
      paint: {
        "text-color": "#e2e8f0",
        "text-halo-color": "#0f1117",
        "text-halo-width": 1.2,
      },
    });
  }

  safeSetVisibility(map, LIVE_ACTIVE_LAYER, layers.activeIncidents);
  safeSetVisibility(map, LIVE_PULSE_LAYER, layers.activeIncidents);
  safeSetVisibility(map, LIVE_RESOLVED_LAYER, layers.resolvedIncidents);
  safeSetVisibility(map, CALLER_LAYER, layers.callerPin);
  safeSetVisibility(map, CALLER_LABEL_LAYER, layers.callerPin);
}

function applySectionLayerVisibility(
  map: maplibregl.Map,
  sections: GeoJSON.FeatureCollection | null | undefined,
  extrude: boolean,
): void {
  const hasFeatures = Boolean(sections?.features?.length);
  safeSetVisibility(map, SECTION_FILL_LAYER, hasFeatures && !extrude);
  safeSetVisibility(map, SECTION_EXTRUSION_LAYER, hasFeatures && extrude);
  safeSetVisibility(map, SECTION_LINE_LAYER, hasFeatures);
  safeSetVisibility(map, SECTION_LABEL_LAYER, hasFeatures);
}

const incidentCursorEnterByMap = new WeakMap<maplibregl.Map, () => void>();
const incidentCursorLeaveByMap = new WeakMap<maplibregl.Map, () => void>();

function bindIncidentInteractions(map: maplibregl.Map, handler: MapClickHandler): void {
  map.off("click", LIVE_ACTIVE_LAYER, handler);
  map.off("click", LIVE_RESOLVED_LAYER, handler);
  map.on("click", LIVE_ACTIVE_LAYER, handler);
  map.on("click", LIVE_RESOLVED_LAYER, handler);

  let onEnter = incidentCursorEnterByMap.get(map);
  if (!onEnter) {
    onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    incidentCursorEnterByMap.set(map, onEnter);
  }
  let onLeave = incidentCursorLeaveByMap.get(map);
  if (!onLeave) {
    onLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    incidentCursorLeaveByMap.set(map, onLeave);
  }

  for (const layerId of [LIVE_ACTIVE_LAYER, LIVE_RESOLVED_LAYER]) {
    map.off("mouseenter", layerId, onEnter);
    map.off("mouseleave", layerId, onLeave);
    map.on("mouseenter", layerId, onEnter);
    map.on("mouseleave", layerId, onLeave);
  }
}

function overlaysToGeoJSON(overlays: RCOperationalOverlay[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: overlays.map((overlay) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [overlay.longitude, overlay.latitude],
      },
      properties: {
        id: overlay.id,
        kind: overlay.kind,
        label: overlay.label,
      },
    })),
  };
}

const overlayClickByMap = new WeakMap<maplibregl.Map, MapClickHandler>();

function bindOverlayInteractions(
  map: maplibregl.Map,
  onSelect: (id: string) => void,
): void {
  const previous = overlayClickByMap.get(map);
  if (previous) {
    map.off("click", OPS_LAYER, previous);
  }
  const handler: MapClickHandler = (event) => {
    const id = String(event.features?.[0]?.properties?.id ?? "");
    if (id) onSelect(id);
  };
  overlayClickByMap.set(map, handler);
  map.on("click", OPS_LAYER, handler);
  map.on("mouseenter", OPS_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", OPS_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });
}

const polygonClickByMap = new WeakMap<maplibregl.Map, MapClickHandler>();

function bindPolygonInteractions(
  map: maplibregl.Map,
  onSelect: (properties: GeoJSON.GeoJsonProperties) => void,
): void {
  const previous = polygonClickByMap.get(map);
  const layers = [SECTION_FILL_LAYER, SECTION_EXTRUSION_LAYER];
  if (previous) {
    for (const layerId of layers) {
      map.off("click", layerId, previous);
    }
  }
  const handler: MapClickHandler = (event) => {
    const props = event.features?.[0]?.properties ?? null;
    if (props) onSelect(props);
  };
  polygonClickByMap.set(map, handler);
  for (const layerId of layers) {
    if (!map.getLayer(layerId)) continue;
    map.on("click", layerId, handler);
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

/**
 * Safely toggle a single MapLibre layer's visibility.
 * Guards against layers that don't exist in the current style — logs a dev
 * warning and continues rather than throwing.
 */
function safeSetVisibility(
  map: maplibregl.Map,
  layerId: string,
  visible: boolean
): void {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  } else if (process.env.NODE_ENV === "development") {
    console.warn(
      `[RapidCortexMap] Layer "${layerId}" not in loaded style — visibility toggle skipped.`
    );
  }
}

/**
 * ALS Maps V2 hides custom layers unless they are assigned to a slot.
 * Promote every runtime overlay (not only leftover Studio IDs) onto `top`.
 */
function promoteStudioOverlays(map: maplibregl.Map): void {
  promoteOverlaySlots(map, [
    ...STUDIO_LAYER_IDS,
    OVERLAY_ZONES_FILL,
    OVERLAY_ZONES_LINE,
    OVERLAY_COUNTIES_LINE,
    OVERLAY_STATES_LINE,
    OVERLAY_AIRPORTS_CIRCLE,
    OVERLAY_AIRPORTS_LABEL,
    ...PSAP_OVERLAY_LAYER_IDS,
    ...HOSPITAL_OVERLAY_LAYER_IDS,
    ...EDUCATION_OVERLAY_LAYER_IDS,
    ...LIVE_CALLER_LAYER_IDS,
    LIVE_ACTIVE_LAYER,
    LIVE_PULSE_LAYER,
    LIVE_RESOLVED_LAYER,
    CALLER_LAYER,
    CALLER_LABEL_LAYER,
    OPS_LAYER,
    OPS_LABEL_LAYER,
    SECTION_FILL_LAYER,
    SECTION_EXTRUSION_LAYER,
    SECTION_LINE_LAYER,
    SECTION_LABEL_LAYER,
  ]);
}

/**
 * Applies the current RCMapLayerVisibility state to overlay layer groups.
 * Studio layers that aren't published yet are silently skipped.
 */
function applyStudioVisibility(
  map: maplibregl.Map,
  layers: RCMapLayerVisibility
): void {
  const groupMap: Array<{ group: keyof typeof STUDIO_LAYER_GROUPS; key: keyof RCMapLayerVisibility }> = [
    { group: "agencyZones",         key: "agencyZones"         },
    { group: "counties",            key: "counties"            },
    { group: "stateBoundaries",     key: "stateBoundaries"     },
    { group: "airports",            key: "airports"            },
    { group: "campusZones",         key: "campusZones"         },
    { group: "venueZones",          key: "venueZones"          },
    { group: "liveTraffic",         key: "liveTraffic"         },
    { group: "liveTrafficClosures", key: "liveTrafficClosures" },
  ];

  for (const { group, key } of groupMap) {
    const layerIds = STUDIO_LAYER_GROUPS[group];
    for (const id of layerIds) {
      safeSetVisibility(map, id, layers[key]);
    }
  }
}
