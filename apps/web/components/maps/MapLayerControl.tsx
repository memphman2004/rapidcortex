"use client";

/**
 * Rapid Cortex — Map Layer Control Panel
 *
 * Floating toggle UI for showing/hiding map overlay groups.
 * Positioned absolute inside the map container — always top-right.
 *
 * Vertical context controls which groups are visible in the control:
 *   core    → agency zones, counties, airports, incidents
 *   campus  → campus zones, incidents
 *   venue   → venue zones, incidents
 *   airport → agency zones, airports, incidents
 */

import { useState } from "react";
import { Layers } from "lucide-react";
import type { RCMapLayerVisibility } from "./map-types";
import { MAP_TOKENS as T } from "./map-constants";
import { isAlsMapApiV2 } from "rapid-cortex-maps";
import { isMapEducationEnabled, isMapHospitalsEnabled } from "@/lib/runtime-flags";

// ─── Per-vertical layer menu config ──────────────────────────────────────────

type LayerKey = keyof RCMapLayerVisibility;

interface LayerToggleItem {
  key:   LayerKey;
  label: string;
  dot?:  string; // optional color indicator dot
}

const BASEMAP_MENU: LayerToggleItem[] = [
  { key: "basemapTerrain",   label: "Terrain",             dot: "#84cc16" },
  { key: "basemapBuildings", label: "3D Buildings",        dot: "#a78bfa" },
  { key: "basemapContours",  label: "Contours",            dot: "#94a3b8" },
  { key: "basemapTransit",   label: "Transit",             dot: "#38bdf8" },
  { key: "basemapSatellite", label: "Satellite / Hybrid",  dot: "#fbbf24" },
];

const OPERATIONAL_MENU: LayerToggleItem[] = [
  { key: "callerPin",      label: "Live Caller Location",  dot: "#0ea5e9" },
  { key: "callerTrail",    label: "Caller Movement Trail", dot: "#38bdf8" },
  { key: "psaps",          label: "PSAPs",                 dot: "#eab308" },
  { key: "hospitals",      label: "Medical",               dot: "#60a5fa" },
  { key: "emergencyRooms", label: "Emergency Rooms",       dot: "#93c5fd" },
  { key: "education",      label: "Schools / Campuses",    dot: "#dc2626" },
];

const LAYER_MENU: Record<"core" | "campus" | "venue" | "airport", LayerToggleItem[]> = {
  core: [
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "stateBoundaries",     label: "State Boundaries",    dot: "#64748b" },
    { key: "airports",            label: "Airports",            dot: "#f59e0b" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
  campus: [
    { key: "campusZones",         label: "Campus Zones",        dot: "#10b981" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
  venue: [
    { key: "venueZones",          label: "Venue Zones",         dot: "#f59e0b" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
  airport: [
    { key: "airports",            label: "Facilities",          dot: "#f59e0b" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MapLayerControlProps {
  layers:         RCMapLayerVisibility;
  onToggle:       (key: LayerKey, value: boolean) => void;
  vertical?:      "core" | "campus" | "venue" | "airport";
  /** Set to false to force the panel open (e.g. wider supervisor layout) */
  collapsible?:   boolean;
}

export function MapLayerControl({
  layers,
  onToggle,
  vertical = "core",
  collapsible = true,
}: MapLayerControlProps) {
  const [open, setOpen] = useState(false);
  const mapsV2 = isAlsMapApiV2();
  const overlayMenu = LAYER_MENU[vertical];
  const hospitalsEnabled = isMapHospitalsEnabled();
  const educationEnabled = isMapEducationEnabled();
  const operationalMenu: LayerToggleItem[] = [
    ...OPERATIONAL_MENU.filter((item) => {
      if (item.key === "hospitals" || item.key === "emergencyRooms") return hospitalsEnabled;
      if (item.key === "education") return educationEnabled;
      return true;
    }),
    ...(vertical === "core" || vertical === "airport"
      ? [{
          key: "agencyZones" as const,
          label: vertical === "airport" ? "Agency / TRACON" : "Agency Zones",
          dot: "#3b82f6",
        }]
      : []),
  ];
  const basemapMenu = mapsV2 ? BASEMAP_MENU : [];
  const menu = [...operationalMenu, ...overlayMenu, ...basemapMenu];

  // Count active (non-default) overrides for the badge
  const activeCount = menu.filter((item) => layers[item.key]).length;

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 10,
        userSelect: "none",
      }}
    >
      {/* Toggle button */}
      {collapsible && (
        <button
          onClick={() => setOpen((o) => !o)}
          title="Map Layers"
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            6,
            background:     T.surface,
            border:         `1px solid ${T.border}`,
            borderRadius:   6,
            padding:        "6px 10px",
            cursor:         "pointer",
            color:          T.text,
            fontSize:       12,
            fontWeight:     600,
            boxShadow:      "0 2px 8px rgba(0,0,0,.45)",
            whiteSpace:     "nowrap",
          }}
        >
          <Layers size={13} color={T.textMuted} />
          <span style={{ color: T.textMuted }}>Layers</span>
          {activeCount > 0 && (
            <span
              style={{
                background:   T.red,
                color:        "#fff",
                fontSize:     9,
                fontWeight:   800,
                borderRadius: 999,
                padding:      "1px 5px",
                lineHeight:   "14px",
              }}
            >
              {activeCount}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {(!collapsible || open) && (
        <div
          style={{
            marginTop:    collapsible ? 6 : 0,
            background:   T.surface,
            border:       `1px solid ${T.border}`,
            borderRadius: 8,
            padding:      "10px 0",
            minWidth:     186,
            boxShadow:    "0 4px 16px rgba(0,0,0,.55)",
          }}
        >
          <div
            style={{
              padding:       "0 12px 8px",
              borderBottom:  `1px solid ${T.border}`,
              marginBottom:  6,
            }}
          >
            <span
              style={{
                fontSize:      10,
                fontWeight:    700,
                color:         T.textMuted,
                letterSpacing: "0.07em",
              }}
            >
              MAP LAYERS
            </span>
          </div>

          {operationalMenu.length > 0 && (
            <>
              <div style={{ padding: "0 12px 8px", marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.textMuted,
                    letterSpacing: "0.07em",
                  }}
                >
                  OPERATIONAL
                </span>
              </div>
              {operationalMenu.map((item) => (
                <LayerToggleRow key={item.key} item={item} enabled={layers[item.key]} onToggle={onToggle} />
              ))}
            </>
          )}

          {overlayMenu.length > 0 && operationalMenu.length > 0 && (
            <div
              style={{
                padding: "10px 12px 8px",
                borderTop: `1px solid ${T.border}`,
                marginTop: 6,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: T.textMuted,
                  letterSpacing: "0.07em",
                }}
              >
                OVERLAYS
              </span>
            </div>
          )}

          {overlayMenu.map((item) => (
            <LayerToggleRow key={item.key} item={item} enabled={layers[item.key]} onToggle={onToggle} />
          ))}

          {basemapMenu.length > 0 && (
            <>
              <div
                style={{
                  padding: "10px 12px 8px",
                  borderTop: `1px solid ${T.border}`,
                  marginTop: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: T.textMuted,
                    letterSpacing: "0.07em",
                  }}
                >
                  BASEMAP
                </span>
              </div>
              {basemapMenu.map((item) => (
                <LayerToggleRow key={item.key} item={item} enabled={layers[item.key]} onToggle={onToggle} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LayerToggleRow({
  item,
  enabled,
  onToggle,
}: {
  item: LayerToggleItem;
  enabled: boolean;
  onToggle: (key: LayerKey, value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onToggle(item.key, !enabled)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "7px 12px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          border: `1.5px solid ${enabled ? (item.dot ?? T.red) : T.border}`,
          background: enabled ? (item.dot ?? T.red) : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background .15s, border-color .15s",
        }}
      >
        {enabled && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {item.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: enabled ? item.dot : T.textDim,
            flexShrink: 0,
            transition: "background .15s",
          }}
        />
      )}
      <span
        style={{
          fontSize: 12,
          color: enabled ? T.text : T.textMuted,
          fontWeight: enabled ? 600 : 400,
          transition: "color .15s",
        }}
      >
        {item.label}
      </span>
    </button>
  );
}
