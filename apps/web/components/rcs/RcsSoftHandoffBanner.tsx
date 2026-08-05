"use client";

import type { RcsSoftHandoff } from "rapid-cortex-shared";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { formatElapsed } from "./rcs-ui-utils";

export type RcsSoftHandoffBannerProps = {
  handoff: RcsSoftHandoff;
  callId?: string;
  onAccept?: () => void;
  onClear?: () => void;
  canAccept?: boolean;
  canClear?: boolean;
};

export function RcsSoftHandoffBanner({
  handoff,
  callId,
  onAccept,
  onClear,
  canAccept = false,
  canClear = false,
}: RcsSoftHandoffBannerProps) {
  if (handoff.state === "CLEARED") return null;

  const isRequested = handoff.state === "REQUESTED";
  const border = isRequested ? "rgba(250, 204, 21, 0.45)" : "rgba(167, 139, 250, 0.45)";
  const bg = isRequested ? "rgba(234, 179, 8, 0.1)" : "rgba(124, 58, 237, 0.1)";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        fontSize: 12,
        color: RCS_SURFACE.bodyText,
      }}
    >
      <span style={{ fontWeight: 700, color: isRequested ? "#fde047" : "#c4b5fd" }}>
        {isRequested ? "SOFT HANDOFF REQUESTED" : "SOFT HANDOFF ACTIVE"}
      </span>
      <span>
        {handoff.requestedByDisplayName}
        {callId ? ` · ${callId}` : ""}
        {" · "}
        {formatElapsed(handoff.requestedAt)} ago
      </span>
      {handoff.note ? (
        <span style={{ color: RCS_SURFACE.subtleText, fontStyle: "italic" }}>{handoff.note}</span>
      ) : null}
      {handoff.state === "ACTIVE" && handoff.acceptedByDisplayName ? (
        <span style={{ color: "#c4b5fd" }}>Covered by {handoff.acceptedByDisplayName}</span>
      ) : null}
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
        {canAccept && isRequested && onAccept ? (
          <button
            type="button"
            onClick={onAccept}
            style={{
              borderRadius: 6,
              border: "1px solid rgba(167, 139, 250, 0.5)",
              background: "rgba(124, 58, 237, 0.25)",
              color: "#e9d5ff",
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            Accept coverage
          </button>
        ) : null}
        {canClear && onClear ? (
          <button
            type="button"
            onClick={onClear}
            style={{
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#cbd5e1",
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        ) : null}
      </span>
    </div>
  );
}
