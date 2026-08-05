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

// ─── Per-vertical layer menu config ──────────────────────────────────────────

type LayerKey = keyof RCMapLayerVisibility;

interface LayerToggleItem {
  key:   LayerKey;
  label: string;
  dot?:  string; // optional color indicator dot
}

const LAYER_MENU: Record<NonNullable<MapLayerControlProps["vertical"]>, LayerToggleItem[]> = {
  core: [
    { key: "agencyZones",         label: "Agency Zones",        dot: "#3b82f6" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "stateBoundaries",     label: "State Boundaries",    dot: "#64748b" },
    { key: "airports",            label: "Airports",            dot: "#f59e0b" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "callerPin",           label: "Caller / Report Pin", dot: "#0ea5e9" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
  campus: [
    { key: "campusZones",         label: "Campus Zones",        dot: "#10b981" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "callerPin",           label: "Caller / Report Pin", dot: "#0ea5e9" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
  venue: [
    { key: "venueZones",          label: "Venue Zones",         dot: "#f59e0b" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "callerPin",           label: "Caller / Report Pin", dot: "#0ea5e9" },
    { key: "liveTraffic",         label: "Live Traffic",        dot: "#22d3ee" },
    { key: "liveTrafficClosures", label: "Traffic Closures",    dot: "#f97316" },
  ],
  airport: [
    { key: "agencyZones",         label: "Agency / TRACON",     dot: "#3b82f6" },
    { key: "airports",            label: "Facilities",          dot: "#f59e0b" },
    { key: "counties",            label: "Counties",            dot: "#94a3b8" },
    { key: "activeIncidents",     label: "Active Incidents",    dot: "#ef4444" },
    { key: "resolvedIncidents",   label: "Resolved Incidents",  dot: "#6b7280" },
    { key: "callerPin",           label: "Report Pin",          dot: "#0ea5e9" },
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
  const menu = LAYER_MENU[vertical];

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

          {menu.map((item) => {
            const enabled = layers[item.key];
            return (
              <button
                key={item.key}
                onClick={() => onToggle(item.key, !enabled)}
                style={{
                  display:         "flex",
                  alignItems:      "center",
                  gap:             8,
                  width:           "100%",
                  padding:         "7px 12px",
                  background:      "transparent",
                  border:          "none",
                  cursor:          "pointer",
                  textAlign:       "left",
                }}
              >
                {/* Checkbox */}
                <span
                  style={{
                    width:        14,
                    height:       14,
                    borderRadius: 3,
                    border:       `1.5px solid ${enabled ? (item.dot ?? T.red) : T.border}`,
                    background:   enabled ? (item.dot ?? T.red) : "transparent",
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent: "center",
                    flexShrink:   0,
                    transition:   "background .15s, border-color .15s",
                  }}
                >
                  {enabled && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>

                {/* Color dot */}
                {item.dot && (
                  <span
                    style={{
                      width:        6,
                      height:       6,
                      borderRadius: "50%",
                      background:   enabled ? item.dot : T.textDim,
                      flexShrink:   0,
                      transition:   "background .15s",
                    }}
                  />
                )}

                {/* Label */}
                <span
                  style={{
                    fontSize:   12,
                    color:      enabled ? T.text : T.textMuted,
                    fontWeight: enabled ? 600 : 400,
                    transition: "color .15s",
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
