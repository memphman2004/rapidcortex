"use client";

/**
 * components/rapid-vision/VisionCameraList.tsx
 *
 * Rapid Vision — Camera discovery and access request list.
 * Shown in the CAMERAS tab of RapidVisionPanel.
 *
 * Displays nearby Vision-eligible cameras with:
 * - Distance and access state
 * - Request access / revoke controls
 * - Provider badges
 * - Demo mode indicator
 */

import { useState } from "react";
import type { VisionCameraSearchResult, VisionAccessState } from "rapid-cortex-shared";

interface Props {
  cameras: VisionCameraSearchResult[];
  onRequestAccess: (cameraId: string, durationMinutes: number) => Promise<void>;
  onRefresh: () => Promise<void>;
  V: Record<string, string>;
}

export function VisionCameraList({
  cameras,
  onRequestAccess,
  onRefresh,
  V,
}: Props) {
  const [requesting, setRequesting] = useState<string | null>(null);

  const handleRequest = async (cameraId: string) => {
    setRequesting(cameraId);
    try {
      await onRequestAccess(cameraId, 15);
    } finally {
      setRequesting(null);
    }
  };

  if (!cameras.length) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 8,
          padding: 24,
          color: V.muted,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="9" width="20" height="14" rx="2" stroke={V.dim} strokeWidth="1.5" />
          <path d="M24 14l5-3v10l-5-3V14z" stroke={V.dim} strokeWidth="1.5" />
        </svg>
        <span style={{ fontSize: 12 }}>No cameras discovered near this incident.</span>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            fontSize: 10,
            color: V.vision,
            background: "transparent",
            border: `1px solid ${V.visionDim}`,
            borderRadius: 5,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Search again
        </button>
      </div>
    );
  }

  // Sort: live first, then by access state, then by distance
  const sorted = [...cameras].sort((a, b) => {
    const order: Record<VisionAccessState, number> = {
      LIVE: 0,
      ANALYZING: 1,
      OBSERVATION_AVAILABLE: 2,
      AUTHORIZED: 3,
      ACCESS_REQUESTED: 4,
      AVAILABLE: 5,
      CONSENT_REQUIRED: 6,
      OWNER_DECLINED: 7,
      ACCESS_EXPIRED: 8,
      DEVICE_OFFLINE: 9,
      PROVIDER_UNAVAILABLE: 10,
      CAPABILITY_NOT_SUPPORTED: 11,
      DEMO: 12,
    };
    return (order[a.accessState] ?? 99) - (order[b.accessState] ?? 99) || a.distanceMeters - b.distanceMeters;
  });

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
      {sorted.map((camera) => (
        <CameraRow
          key={camera.cameraId}
          camera={camera}
          requesting={requesting === camera.cameraId}
          onRequest={() => handleRequest(camera.cameraId)}
          V={V}
        />
      ))}
    </div>
  );
}

function CameraRow({
  camera,
  requesting,
  onRequest,
  V,
}: {
  camera: VisionCameraSearchResult;
  requesting: boolean;
  onRequest: () => void;
  V: Record<string, string>;
}) {
  const distLabel =
    camera.distanceMeters < 1000
      ? `${Math.round(camera.distanceMeters)}m`
      : `${(camera.distanceMeters / 1609.34).toFixed(2)}mi`;

  const isLive = camera.accessState === "LIVE" || camera.accessState === "ANALYZING";
  const isOffline = camera.accessState === "DEVICE_OFFLINE";
  const canRequest =
    camera.accessState === "AVAILABLE" || camera.accessState === "CONSENT_REQUIRED";

  return (
    <div
      style={{
        margin: "0 10px 6px",
        padding: "9px 11px",
        background: isLive ? `${V.vision}0a` : V.surfaceRaised ?? "#141122",
        border: `1px solid ${isLive ? V.visionDim : V.border}`,
        borderRadius: 7,
        opacity: isOffline ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Camera icon + live indicator */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1" y="4" width="12" height="10" rx="2" stroke={isLive ? V.vision : V.muted} strokeWidth="1.5" />
          <path d="M13 8l4-2v6l-4-2V8z" stroke={isLive ? V.vision : V.muted} strokeWidth="1.5" />
        </svg>
        {isLive && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: V.vision,
            }}
          />
        )}
      </div>

      {/* Camera info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isOffline ? V.muted : V.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {camera.friendlyName}
          {camera.provider === "demo" && (
            <span
              style={{
                fontSize: 8,
                color: V.muted,
                marginLeft: 5,
                fontWeight: 400,
              }}
            >
              DEMO
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 2,
          }}
        >
          <span style={{ fontSize: 9, color: V.muted }}>{distLabel}</span>
          <span style={{ fontSize: 9, color: V.dim }}>·</span>
          <AccessStateBadge state={camera.accessState} V={V} />
          <span style={{ fontSize: 9, color: V.dim }}>·</span>
          <span style={{ fontSize: 9, color: V.muted, textTransform: "uppercase" }}>
            {camera.provider}
          </span>
        </div>
      </div>

      {/* Action */}
      {canRequest && (
        <button
          type="button"
          onClick={onRequest}
          disabled={requesting}
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: requesting ? V.muted : V.vision,
            background: "transparent",
            border: `1px solid ${requesting ? V.dim : V.visionDim}`,
            borderRadius: 4,
            padding: "3px 9px",
            cursor: requesting ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {requesting ? "…" : camera.accessState === "CONSENT_REQUIRED" ? "REQUEST" : "CONNECT"}
        </button>
      )}

      {isLive && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: V.vision,
            letterSpacing: "0.05em",
          }}
        >
          ● LIVE
        </span>
      )}
    </div>
  );
}

function AccessStateBadge({ state, V }: { state: VisionAccessState; V: Record<string, string> }) {
  const config: Record<VisionAccessState, { label: string; color: string }> = {
    AVAILABLE: { label: "available", color: V.verified },
    CONSENT_REQUIRED: { label: "consent required", color: V.unverified },
    ACCESS_REQUESTED: { label: "requested", color: V.unverified },
    AUTHORIZED: { label: "authorized", color: V.vision },
    LIVE: { label: "live", color: V.vision },
    ANALYZING: { label: "analyzing", color: V.vision },
    OBSERVATION_AVAILABLE: { label: "observation", color: V.vision },
    OWNER_DECLINED: { label: "declined", color: V.rejected },
    ACCESS_EXPIRED: { label: "expired", color: V.muted },
    DEVICE_OFFLINE: { label: "offline", color: V.muted },
    PROVIDER_UNAVAILABLE: { label: "unavailable", color: V.muted },
    CAPABILITY_NOT_SUPPORTED: { label: "not supported", color: V.muted },
    DEMO: { label: "demo", color: V.muted },
  };

  const { label, color } = config[state] ?? { label: state.toLowerCase(), color: V.muted };

  return (
    <span
      style={{
        fontSize: 9,
        color,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}
