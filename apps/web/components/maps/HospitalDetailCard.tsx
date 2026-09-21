"use client";

import type { AlsHospitalFeatureProperties } from "rapid-cortex-shared";
import {
  hospitalDetailsUrl,
  hospitalDirectionsUrl,
  hospitalFacilityLabel,
  hospitalTelHref,
} from "./hospital-overlay";

export function HospitalDetailCard({
  props,
  coordinates,
  onClose,
}: {
  props: AlsHospitalFeatureProperties;
  coordinates: [number, number];
  onClose: () => void;
}) {
  const [lng, lat] = coordinates;
  const tel = hospitalTelHref(props.phone);
  const facility = hospitalFacilityLabel(props.category, props.emergencyRoom);
  return (
    <div
      role="dialog"
      aria-label={props.name || "Hospital"}
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 11,
        width: 280,
        background: "#0f0d1c",
        border: "1px solid #1e1a30",
        borderTop: "3px solid #60a5fa",
        borderRadius: 8,
        padding: "12px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,.55)",
        fontFamily: "system-ui,-apple-system,sans-serif",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close hospital details"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "transparent",
          border: "none",
          color: "#5a4d7a",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#60a5fa", letterSpacing: "0.06em", marginBottom: 4 }}>
        HOSPITAL
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e4dff5", paddingRight: 18, marginBottom: 4 }}>
        {props.name || "Hospital"}
      </div>
      <div style={{ fontSize: 11, color: "#93c5fd", marginBottom: 6 }}>{facility}</div>
      {props.address ? (
        <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.4, marginBottom: 8 }}>{props.address}</div>
      ) : null}
      <div style={{ fontSize: 12, color: "#c4b5fd", lineHeight: 1.55, marginBottom: 12 }}>
        <div>Emergency Room: {props.emergencyRoom ? "Yes" : "No"}</div>
        {props.phone ? (
          <div>
            Phone:{" "}
            {tel ? (
              <a href={tel} style={{ color: "#67e8f9", textDecoration: "none" }}>
                {props.phone}
              </a>
            ) : (
              props.phone
            )}
          </div>
        ) : null}
        {props.distance ? <div>Distance: {props.distance}</div> : null}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <a
          href={hospitalDirectionsUrl(lng, lat)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#0f0d1c",
            background: "#60a5fa",
            borderRadius: 5,
            padding: "7px 8px",
            textDecoration: "none",
          }}
        >
          Directions
        </a>
        <a
          href={hospitalDetailsUrl(props)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#e4dff5",
            background: "#1e1a30",
            borderRadius: 5,
            padding: "7px 8px",
            textDecoration: "none",
          }}
        >
          View Details
        </a>
      </div>
    </div>
  );
}
