"use client";

/**
 * Rapid Cortex — Map Core Component
 *
 * NEVER import this file directly in pages or server components.
 * It is loaded exclusively via Next.js dynamic import with ssr: false
 * from RapidCortexMap.tsx to prevent SSR crashes from mapbox-gl's
 * reliance on browser globals (window, navigator, WebGL).
 *
 * Architecture:
 *   RapidCortexMap.tsx  →  dynamic(() => import('./RapidCortexMapCore'))
 *                                              ↑
 *                                       This file
 */

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";

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
  resolveMapStyleUrl,
  SEVERITY_COLOR_EXPRESSION,
  SEVERITY_RADIUS_EXPRESSION,
  STUDIO_LAYER_GROUPS,
  STUDIO_LAYER_IDS,
} from "./map-constants";
import type {
  RCIncident,
  RCMapLayerVisibility,
  RCMapProps,
  RCOperationalOverlay,
} from "./map-types";
import { DEFAULT_LAYER_VISIBILITY } from "./map-types";
import { buildCallerPopupHTML, buildIncidentPopupHTML, incidentsToGeoJSON } from "./map-utils";
import { MapLayerControl } from "./MapLayerControl";
import {
  loadMapLayers,
  loadMapTheme,
  saveMapLayers,
  saveMapTheme,
} from "@/lib/maps/persisted-map-prefs";

type MapClickHandler = (
  e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
) => void;

const EMPTY_SECTION_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

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
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
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
  const clickHandlerRef = useRef<MapClickHandler>(() => undefined);
  const lastCommandIdRef = useRef<number | null>(null);

  const [mapReady,  setMapReady]  = useState(false);
  const [mapError,  setMapError]  = useState<string | null>(null);
  const [localTheme, setLocalTheme] = useState<"dark" | "light">(themeProp);
  const [layers, setLayers]       = useState<RCMapLayerVisibility>({
    ...DEFAULT_LAYER_VISIBILITY,
    ...defaultLayers,
  });

  const theme = onThemeChange ? themeProp : localTheme;

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

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
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!token || token === "pk.REPLACE_WITH_REAL_TOKEN") {
      setMapError("Map isn’t configured for this environment. Contact Rapid Cortex support.");
      return;
    }

    mapboxgl.accessToken = token;

    const initialTheme = themeProp;
    appliedThemeRef.current = initialTheme;

    const map = new mapboxgl.Map({
      container:          containerRef.current,
      style:              resolveMapStyleUrl(initialTheme),
      center:             [centerLng ?? DEFAULT_CENTER[0], centerLat ?? DEFAULT_CENTER[1]],
      zoom:               zoom ?? DEFAULT_ZOOM,
      pitch:              pitchProp,
      bearing:            bearingProp,
      maxPitch:           60,
      attributionControl: false,
      logoPosition:       "bottom-left",
      trackResize:        true,
    });

    mapRef.current = map;

    // Controls
    if (showZoomControl) {
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );
    }
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-left"
    );

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
      promoteStudioOverlays(map);
      applyStudioVisibility(map, layersRef.current);
      bindIncidentInteractions(map, onIncidentLayerClick);
      bindOverlayInteractions(map, (id) => {
        const overlay = overlaysRef.current.find((item) => item.id === id);
        if (overlay) overlayClickRef.current?.(overlay);
      });
      bindPolygonInteractions(map, (props) => polygonClickRef.current?.(props));
      // Dock modules mount hidden (`display: none`); canvas is ~300px until shown.
      map.resize();
      setMapReady(true);
      onMapReady?.();
    });

    // Handle style load errors
    map.on("error", (e) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[RapidCortexMap] Mapbox error:", e);
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
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only runs on mount — intentional

  // ─── Swap Mapbox Studio style when theme changes ─────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (appliedThemeRef.current === theme) return;

    appliedThemeRef.current = theme;
    setMapReady(false);
    popupRef.current?.remove();

    const onStyleLoad = () => {
      ensureLiveLayers(
        map,
        layersRef.current,
        incidentsRef.current,
        overlaysRef.current,
        sectionsRef.current,
        extrusionRef.current,
      );
      promoteStudioOverlays(map);
      applyStudioVisibility(map, layersRef.current);
      bindIncidentInteractions(map, (e) => clickHandlerRef.current(e));
      bindOverlayInteractions(map, (id) => {
        const overlay = overlaysRef.current.find((item) => item.id === id);
        if (overlay) overlayClickRef.current?.(overlay);
      });
      bindPolygonInteractions(map, (props) => polygonClickRef.current?.(props));
      map.resize();
      setMapReady(true);
    };

    map.once("style.load", onStyleLoad);
    map.setStyle(resolveMapStyleUrl(theme));
  }, [theme, mapReady]);

  // ─── Update live incidents when prop changes ─────────────────────────────

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(LIVE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(incidentsToGeoJSON(incidents));
  }, [incidents, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(OPS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(overlaysToGeoJSON(operationalOverlays));
  }, [operationalOverlays, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource(SECTION_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
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
    popupRef.current = new mapboxgl.Popup({
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
    const source = mapRef.current.getSource(CALLER_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;

    if (!callerLocation) {
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
            coordinates: [callerLocation.lng, callerLocation.lat],
          },
          properties: {
            label:  callerLocation.label ?? "Caller Location",
            source: callerLocation.source ?? "reported",
          },
        },
      ],
    });
  }, [callerLocation, mapReady]);

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
  }, [layers, mapReady]);

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
    popupRef.current = new mapboxgl.Popup({
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

      {/* Dark / light Studio style toggle — above Mapbox +/- (bottom-right) */}
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
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .mapboxgl-popup-tip {
          display: none !important;
        }
        .mapboxgl-popup-close-button {
          color: #5a4d7a !important;
          font-size: 16px !important;
          padding: 4px 8px !important;
          right: 2px !important;
          top: 2px !important;
          background: transparent !important;
        }
        .mapboxgl-popup-close-button:hover {
          color: #e4dff5 !important;
          background: transparent !important;
        }
        .mapboxgl-ctrl-bottom-right {
          bottom: 8px !important;
          right: 8px !important;
        }
        .mapboxgl-ctrl-group {
          background: #100e1a !important;
          border: 1px solid #1e1a30 !important;
          box-shadow: 0 2px 6px rgba(0,0,0,.5) !important;
        }
        .mapboxgl-ctrl-group button {
          background-color: #100e1a !important;
          border-color: #1e1a30 !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background-color: #1e1a30 !important;
        }
        .mapboxgl-ctrl-icon {
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

/** Re-add app-managed GeoJSON sources/layers after initial load or setStyle. */
function ensureLiveLayers(
  map: mapboxgl.Map,
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
    (map.getSource(SECTION_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(sections);
  }

  if (!map.getLayer(SECTION_FILL_LAYER)) {
    map.addLayer({
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
    map.addLayer({
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
    map.addLayer({
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
    map.addLayer({
      id: SECTION_LABEL_LAYER,
      type: "symbol",
      source: SECTION_SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 11,
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
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

  if (!map.getSource(LIVE_SOURCE_ID)) {
    map.addSource(LIVE_SOURCE_ID, {
      type: "geojson",
      data: incidentsToGeoJSON(incidents),
    });
  } else {
    (map.getSource(LIVE_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(
      incidentsToGeoJSON(incidents)
    );
  }

  if (!map.getLayer(LIVE_ACTIVE_LAYER)) {
    map.addLayer({
      id:     LIVE_ACTIVE_LAYER,
      type:   "circle",
      source: LIVE_SOURCE_ID,
      filter: ["!=", ["get", "status"], "resolved"],
      paint:  {
        "circle-radius":       SEVERITY_RADIUS_EXPRESSION,
        "circle-color":        SEVERITY_COLOR_EXPRESSION,
        "circle-opacity":      0.92,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    });
  }

  if (!map.getLayer(LIVE_PULSE_LAYER)) {
    map.addLayer({
      id:     LIVE_PULSE_LAYER,
      type:   "circle",
      source: LIVE_SOURCE_ID,
      filter: ["in", ["get", "severity"], ["literal", ["critical", "high"]]],
      paint:  {
        "circle-radius":         ["interpolate", ["linear"], ["zoom"], 8, 18, 14, 24],
        "circle-color":          "transparent",
        "circle-stroke-width":   2,
        "circle-stroke-color":   "#ef4444",
        "circle-stroke-opacity": 0.35,
      },
    });
  }

  if (!map.getLayer(LIVE_RESOLVED_LAYER)) {
    map.addLayer({
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
    map.addLayer({
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
    map.addLayer({
      id:     CALLER_LABEL_LAYER,
      type:   "symbol",
      source: CALLER_SOURCE_ID,
      layout: {
        "text-field":      ["get", "label"],
        "text-size":       11,
        "text-offset":     [0, 1.8],
        "text-anchor":     "top",
        "text-font":       ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
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
    (map.getSource(OPS_SOURCE_ID) as mapboxgl.GeoJSONSource).setData(overlaysToGeoJSON(overlays));
  }

  if (!map.getLayer(OPS_LAYER)) {
    map.addLayer({
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
    map.addLayer({
      id: OPS_LABEL_LAYER,
      type: "symbol",
      source: OPS_SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 10,
        "text-offset": [0, 1.4],
        "text-anchor": "top",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
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
  map: mapboxgl.Map,
  sections: GeoJSON.FeatureCollection | null | undefined,
  extrude: boolean,
): void {
  const hasFeatures = Boolean(sections?.features?.length);
  safeSetVisibility(map, SECTION_FILL_LAYER, hasFeatures && !extrude);
  safeSetVisibility(map, SECTION_EXTRUSION_LAYER, hasFeatures && extrude);
  safeSetVisibility(map, SECTION_LINE_LAYER, hasFeatures);
  safeSetVisibility(map, SECTION_LABEL_LAYER, hasFeatures);
}

const incidentCursorEnterByMap = new WeakMap<mapboxgl.Map, () => void>();
const incidentCursorLeaveByMap = new WeakMap<mapboxgl.Map, () => void>();

function bindIncidentInteractions(map: mapboxgl.Map, handler: MapClickHandler): void {
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

const overlayClickByMap = new WeakMap<mapboxgl.Map, MapClickHandler>();

function bindOverlayInteractions(
  map: mapboxgl.Map,
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

const polygonClickByMap = new WeakMap<mapboxgl.Map, MapClickHandler>();

function bindPolygonInteractions(
  map: mapboxgl.Map,
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
 * Safely toggle a single Mapbox layer's visibility.
 * Guards against layers that don't exist in the current style — logs a dev
 * warning and continues rather than throwing.
 */
function safeSetVisibility(
  map: mapboxgl.Map,
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
 * Mapbox Standard (imported basemap) requires custom layers to declare a slot
 * or they can fail to paint. Force known RC overlays into the top slot.
 */
function promoteStudioOverlays(map: mapboxgl.Map): void {
  for (const layerId of STUDIO_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue;
    try {
      const withSlot = map as mapboxgl.Map & {
        setSlot?: (id: string, slot: string) => void;
      };
      if (typeof withSlot.setSlot === "function") {
        withSlot.setSlot(layerId, "top");
      }
    } catch {
      /* older GL builds / unsupported — visibility toggles still apply */
    }
  }
}

/**
 * Applies the current RCMapLayerVisibility state to all Mapbox Studio layer groups.
 * Studio layers that aren't published yet are silently skipped.
 */
function applyStudioVisibility(
  map: mapboxgl.Map,
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
