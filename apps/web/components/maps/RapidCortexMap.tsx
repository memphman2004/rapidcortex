/**
 * Rapid Cortex — Public Map Component
 *
 * This is the file to import everywhere in the app.
 * It wraps RapidCortexMapCore via Next.js dynamic import with ssr: false,
 * preventing mapbox-gl from crashing during server-side rendering.
 *
 * Usage:
 *   import { RapidCortexMap } from "@/components/maps/RapidCortexMap";
 *
 *   <RapidCortexMap
 *     incidents={activeIncidents}
 *     selectedIncidentId={openIncidentId}
 *     onIncidentClick={(inc) => setOpenIncident(inc.id)}
 *     callerLocation={callerGPS}
 *     vertical="venue"
 *     height="420px"
 *   />
 *
 * Required env vars (set in .env.local or env-web-*.sh):
 *   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN      — public token, URL-referrer restricted
 *   NEXT_PUBLIC_MAPBOX_STYLE_URL_DARK    — dark dispatch Studio style
 *   NEXT_PUBLIC_MAPBOX_STYLE_URL_LIGHT   — light Studio style
 *   NEXT_PUBLIC_MAPBOX_STYLE_URL         — legacy dark fallback
 */

"use client";

import dynamic from "next/dynamic";
import type { RCMapProps } from "./map-types";
import { MAP_TOKENS as T } from "./map-constants";

// ─── Dynamic import — prevents SSR crash ─────────────────────────────────────

const RapidCortexMapCore = dynamic(
  () => import("./RapidCortexMapCore"),
  {
    ssr:     false,
    loading: () => <MapSkeleton />,
  }
);

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * Drop-in map component. SSR-safe. Renders a skeleton while the Mapbox bundle
 * and style load. All props are forwarded to RapidCortexMapCore.
 */
export function RapidCortexMap(props: RCMapProps) {
  return (
    <div
      className={props.className}
      style={{
        position:     "relative",
        width:        "100%",
        height:       props.height ?? "100%",
        borderRadius: 8,
        overflow:     "hidden",
        background:   props.theme === "light" ? "#ffffff" : T.surface,
      }}
    >
      <RapidCortexMapCore {...props} />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MapSkeleton() {
  return (
    <div
      style={{
        position:       "absolute",
        inset:          0,
        background:     T.surface,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            10,
      }}
    >
      <MapPinIcon />
      <span
        style={{
          fontSize:      11,
          fontWeight:    600,
          color:         T.textMuted,
          letterSpacing: "0.06em",
        }}
      >
        LOADING MAP…
      </span>
      <style>{`
        @keyframes rc-skeleton-pulse {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "rc-skeleton-pulse 1.4s ease-in-out infinite" }}
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill={T.red}
        opacity={0.7}
      />
      <circle cx="12" cy="9" r="2.5" fill="#fff" opacity={0.9} />
    </svg>
  );
}

// ─── Named re-exports for convenience ────────────────────────────────────────

export type { RCMapProps, RCIncident, RCCallerLocation, RCMapLayerVisibility } from "./map-types";
export { DEFAULT_LAYER_VISIBILITY } from "./map-types";
export { MOCK_INCIDENTS } from "./map-utils";
