/**
 * MapPreviewButton.tsx
 * Replaces the "Open map preview" anchor in the Caller / Premise panel.
 *
 * Behavior:
 *  1. If lat/lng are already known (from incident GPS data) → open MapModal immediately
 *  2. If only an address string is available → geocode via Mapbox Geocoding API first,
 *     then open MapModal at the returned coordinates
 *  3. If Mapbox token is missing OR geocoding fails → fall back to Google Maps in a new tab
 *     (same behavior as before, but only as a last resort)
 *
 * FIND AND REPLACE in the Caller/Premise panel component:
 *
 *   Search for any of these patterns:
 *     window.open(`https://maps.google.com/?q=${address}`, '_blank')
 *     href={`https://maps.google.com/?q=...`}
 *     <a ... target="_blank">Open map preview</a>
 *
 *   Replace the entire element with:
 *     <MapPreviewButton
 *       address={callerAddress}
 *       lat={incident.callerLocationLat}    // optional — pass if you have it
 *       lng={incident.callerLocationLng}    // optional — pass if you have it
 *       label={callerAddress}
 *       incidentId={incident.incidentId}
 *     />
 *
 * Place at: apps/web/components/dispatcher/MapPreviewButton.tsx
 *
 * Depends on: mapbox-incident-map.tsx (already written — must be at same path level)
 * Import:     import { MapModal } from "@/components/maps/mapbox-incident-map";
 */

"use client";

import { useState, useCallback } from "react";
import { MapModal } from "@/components/maps/mapbox-incident-map";

// ─── Config ───────────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const TOKEN_OK = MAPBOX_TOKEN.startsWith("pk.") && !MAPBOX_TOKEN.includes("REPLACE");

const GEOCODE_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MapPreviewButtonProps {
  /** Street address string — used for geocoding when lat/lng aren't available */
  address: string;
  /** Known latitude — skips geocoding when provided */
  lat?: number | null;
  /** Known longitude — skips geocoding when provided */
  lng?: number | null;
  /** Label shown in the map pin popup */
  label?: string;
  /** Incident ID shown in the modal header */
  incidentId?: string;
  /** Caller phone number shown in the modal header */
  callerNumber?: string;
  /** Visual style — "link" matches the existing blue text link; "button" is a pill button */
  variant?: "link" | "button";
}

type GeoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; lat: number; lng: number };

// ─── Geocoding ────────────────────────────────────────────────────────────────

async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!TOKEN_OK) return null;

  const encoded = encodeURIComponent(address.trim());
  const url = `${GEOCODE_BASE}/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place,poi`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json() as {
      features?: Array<{ center: [number, number] }>;
    };

    const center = data.features?.[0]?.center;
    if (!center || center.length < 2) return null;

    return { lat: center[1], lng: center[0] };
  } catch {
    return null;
  }
}

// ─── Google Maps fallback URL ─────────────────────────────────────────────────

function googleMapsUrl(address: string, lat?: number | null, lng?: number | null): string {
  if (lat != null && lng != null) {
    // Pin exact coordinates — much better than a search
    return `https://www.google.com/maps?q=${lat},${lng}&z=15`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapPreviewButton({
  address,
  lat,
  lng,
  label,
  incidentId,
  callerNumber,
  variant = "link",
}: MapPreviewButtonProps) {
  const [geoState, setGeoState] = useState<GeoState>({ status: "idle" });
  const [showModal, setShowModal] = useState(false);

  // Resolved coordinates: from props or from geocoding
  const resolvedLat = geoState.status === "ready" ? geoState.lat : lat ?? null;
  const resolvedLng = geoState.status === "ready" ? geoState.lng : lng ?? null;

  const handleClick = useCallback(async () => {
    // Case 1: coordinates already known
    if (lat != null && lng != null) {
      setShowModal(true);
      return;
    }

    // Case 2: Mapbox token missing → go straight to Google fallback
    if (!TOKEN_OK) {
      window.open(googleMapsUrl(address, lat, lng), "_blank", "noopener,noreferrer");
      return;
    }

    // Case 3: need to geocode first
    if (geoState.status === "loading") return; // prevent double-click

    setGeoState({ status: "loading" });
    const result = await geocodeAddress(address);

    if (result) {
      setGeoState({ status: "ready", lat: result.lat, lng: result.lng });
      setShowModal(true);
    } else {
      // Geocoding failed — fall back to Google Maps
      setGeoState({ status: "error", message: "Geocoding failed" });
      window.open(googleMapsUrl(address, lat, lng), "_blank", "noopener,noreferrer");
    }
  }, [address, lat, lng, geoState.status]);

  const isLoading = geoState.status === "loading";

  // ── Render: link variant (matches existing "Open map preview" style) ─────────
  if (variant === "link") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isLoading}
          title={
            !TOKEN_OK
              ? "Mapbox not configured — will open Google Maps"
              : `Open map for ${address}`
          }
          style={{
            background:    "transparent",
            border:        "none",
            padding:       0,
            cursor:        isLoading ? "wait" : "pointer",
            color:         isLoading ? "#5a4d7a" : "#3b82f6",
            fontSize:      "inherit",
            fontFamily:    "inherit",
            textDecoration: isLoading ? "none" : "underline",
            textUnderlineOffset: 2,
            display:       "inline-flex",
            alignItems:    "center",
            gap:           5,
          }}
        >
          {isLoading ? (
            <>
              <SpinnerIcon />
              Locating…
            </>
          ) : (
            <>
              <MapPinIcon color={!TOKEN_OK ? "#f59e0b" : "#3b82f6"} />
              Open map preview
              {!TOKEN_OK && (
                <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 2 }}>
                  (Google)
                </span>
              )}
            </>
          )}
        </button>

        {/* Geocode error hint — shown briefly then clears */}
        {geoState.status === "error" && (
          <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 8 }}>
            ⚠ Opened in Google Maps (geocoding unavailable)
          </span>
        )}

        {/* Mapbox modal */}
        {showModal && resolvedLat != null && resolvedLng != null && (
          <MapModal
            lat={resolvedLat}
            lng={resolvedLng}
            label={label ?? address}
            incidentId={incidentId}
            callerNumber={callerNumber}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  // ── Render: button variant ────────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           6,
          padding:       "6px 12px",
          background:    isLoading ? "#100e1a" : "rgba(59,130,246,0.08)",
          border:        `1px solid ${isLoading ? "#1e1a30" : "rgba(59,130,246,0.3)"}`,
          borderRadius:  6,
          color:         isLoading ? "#5a4d7a" : "#3b82f6",
          fontSize:      12,
          fontWeight:    600,
          cursor:        isLoading ? "wait" : "pointer",
          fontFamily:    "inherit",
          transition:    "all 0.15s",
          letterSpacing: "0.02em",
        }}
      >
        {isLoading ? <SpinnerIcon /> : <MapPinIcon color="#3b82f6" />}
        {isLoading ? "Locating address…" : "Open map preview"}
        {!TOKEN_OK && !isLoading && (
          <span style={{ fontSize: 10, color: "#f59e0b", opacity: 0.8 }}>(Google)</span>
        )}
      </button>

      {geoState.status === "error" && (
        <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 4 }}>
          ⚠ Mapbox geocoding failed — opened Google Maps instead
        </div>
      )}

      {showModal && resolvedLat != null && resolvedLng != null && (
        <MapModal
          lat={resolvedLat}
          lng={resolvedLng}
          label={label ?? address}
          incidentId={incidentId}
          callerNumber={callerNumber}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function MapPinIcon({ color = "#3b82f6" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      width={13}
      height={13}
      style={{ flexShrink: 0 }}
    >
      <path
        d="M8 1.5A4.5 4.5 0 0 1 12.5 6c0 3-4.5 8.5-4.5 8.5S3.5 9 3.5 6A4.5 4.5 0 0 1 8 1.5Z"
        stroke={color}
        strokeWidth={1.4}
        fill={`${color}22`}
      />
      <circle cx={8} cy={6} r={1.5} fill={color} />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={13}
      height={13}
      style={{ flexShrink: 0, animation: "rc-spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes rc-spin { to { transform: rotate(360deg) } }`}</style>
      <circle
        cx={8}
        cy={8}
        r={6}
        stroke="#5a4d7a"
        strokeWidth={2}
        fill="none"
        strokeDasharray="20 18"
        strokeLinecap="round"
      />
    </svg>
  );
}
