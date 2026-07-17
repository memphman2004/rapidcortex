"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { QRLocation } from "rapid-cortex-shared";
import { Map as MapIcon } from "lucide-react";
import { RapidCortexMap } from "rapid-cortex-maps";

const PANEL = {
  surface: "#100e1a",
  surfaceAlt: "#141220",
  border: "#1e1a30",
  textMuted: "#2d2445",
};

const VERTICAL_THEME: Record<"venue" | "campus", { theme: "dark" | "satellite"; accent: string }> = {
  venue: { theme: "dark", accent: "#f59e0b" },
  campus: { theme: "satellite", accent: "#10b981" },
};

export interface VenueLocationMapProps {
  locations: QRLocation[];
  isLoading: boolean;
  vertical: "venue" | "campus";
  linkBase: string;
}

function isMappable(loc: QRLocation): loc is QRLocation & { lat: number; lng: number } {
  return (
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    loc.lat >= -90 &&
    loc.lat <= 90 &&
    loc.lng >= -180 &&
    loc.lng <= 180
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function LocationPin({
  map,
  location,
  accent,
  linkBase,
}: {
  map: mapboxgl.Map | null;
  location: QRLocation & { lat: number; lng: number };
  accent: string;
  linkBase: string;
}) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const mount = () => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: ${location.active ? accent : "#475569"};
        border: 2px solid ${location.active ? accent : "#334155"};
        box-shadow: 0 0 6px ${location.active ? `${accent}88` : "transparent"};
        cursor: pointer;
        transition: transform 0.15s ease;
      `;
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.6)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1)";
      });

      const popup = new mapboxgl.Popup({
        offset: 12,
        closeButton: false,
        maxWidth: "220px",
        className: "rc-map-popup",
      }).setHTML(`
        <div style="background:#141220;border:1px solid #1e1a30;border-radius:6px;padding:10px 12px;font-family:inherit;">
          <div style="font-size:12px;font-weight:700;color:#e4dff5;margin-bottom:4px;">${escapeHtml(location.locationName)}</div>
          <div style="font-size:10px;color:#5a4d7a;margin-bottom:6px;">${escapeHtml(location.zone ?? location.zoneCode)}</div>
          <div style="font-size:10px;color:#7c6fa0;margin-bottom:8px;">Scans: <strong style="color:#e4dff5">${location.scanCount ?? 0}</strong></div>
          <a href="${escapeHtml(linkBase)}/admin/locations/${escapeHtml(location.rcli)}" style="display:block;font-size:10px;color:${accent};text-decoration:none;font-weight:600;">View sign package →</a>
        </div>
      `);

      const next = new mapboxgl.Marker({ element: el })
        .setLngLat([location.lng, location.lat])
        .setPopup(popup)
        .addTo(map);
      markerRef.current?.remove();
      markerRef.current = next;
    };

    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);

    return () => {
      map.off("load", mount);
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map, location, accent, linkBase]);

  return null;
}

/** Fits the map to all mappable locations once both the map and data are ready. */
function useFitBounds(map: mapboxgl.Map | null, points: Array<{ lat: number; lng: number }>) {
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.flyTo({ center: [points[0].lng, points[0].lat], zoom: 17, duration: 600 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    points.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 32, maxZoom: 18, duration: 600 });
  }, [map, points]);
}

export function VenueLocationMap({ locations, isLoading, vertical, linkBase }: VenueLocationMapProps) {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const { theme, accent } = VERTICAL_THEME[vertical];

  useEffect(() => {
    if (!map) return;
    const onError = () => setMapError("Map failed to load.");
    map.on("error", onError);
    return () => {
      map.off("error", onError);
    };
  }, [map]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const tokenMissing = !token || token === "pk.REPLACE_WITH_REAL_TOKEN";

  const mappable = useMemo(() => locations.filter(isMappable), [locations]);
  const unmappedCount = locations.length - mappable.length;
  const initialCenter = useMemo<[number, number]>(
    () => (mappable.length > 0 ? [mappable[0].lng, mappable[0].lat] : [-98.5795, 39.8283]),
    [mappable],
  );

  useFitBounds(map, mappable);

  return (
    <div style={{ background: PANEL.surface, border: `1px solid ${PANEL.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${PANEL.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MapIcon size={13} color="#7c6fa0" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#7c6fa0", letterSpacing: "0.05em" }}>
            LOCATION MAP
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {unmappedCount > 0 ? (
            <span style={{ fontSize: 10, color: PANEL.textMuted }}>{unmappedCount} unmapped</span>
          ) : null}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: accent,
              background: `${accent}18`,
              padding: "2px 7px",
              borderRadius: 999,
            }}
          >
            {mappable.length} location{mappable.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div style={{ position: "relative", height: 260 }}>
        {isLoading ? (
          <div style={emptyStateStyle}>
            <span style={{ fontSize: 11, color: PANEL.textMuted }}>Loading map…</span>
          </div>
        ) : tokenMissing || mapError ? (
          <div style={emptyStateStyle}>
            <MapIcon size={20} color={PANEL.textMuted} />
            <span style={{ fontSize: 11, color: PANEL.textMuted }}>
              {mapError ?? "Map configuration unavailable."}
            </span>
          </div>
        ) : locations.length === 0 ? (
          <div style={emptyStateStyle}>
            <MapIcon size={20} color={PANEL.textMuted} />
            <span style={{ fontSize: 11, color: PANEL.textMuted }}>No codes deployed yet.</span>
          </div>
        ) : mappable.length === 0 ? (
          <div style={emptyStateStyle}>
            <MapIcon size={20} color={PANEL.textMuted} />
            <span style={{ fontSize: 11, color: PANEL.textMuted, textAlign: "center", maxWidth: 200 }}>
              Sign locations appear here after codes are created via the RC mobile app.
            </span>
          </div>
        ) : null}

        {!tokenMissing && !isLoading ? (
          <RapidCortexMap
            center={initialCenter}
            zoom={mappable.length > 0 ? 15 : 4}
            theme={theme}
            showControls
            onMapLoad={setMap}
          >
            {map
              ? mappable.map((loc) => (
                  <LocationPin key={loc.rcli} map={map} location={loc} accent={accent} linkBase={linkBase} />
                ))
              : null}
          </RapidCortexMap>
        ) : null}
      </div>
    </div>
  );
}

const emptyStateStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: PANEL.surfaceAlt,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  zIndex: 10,
};
