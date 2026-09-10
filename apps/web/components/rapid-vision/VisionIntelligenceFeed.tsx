"use client";

import { useEffect, useRef, useState } from "react";
import type { VisionObservation } from "rapid-cortex-shared";

export type StreamingObservationEntry = {
  cameraName: string;
  text: string;
  timestamp: string;
};

interface FeedProps {
  observations: VisionObservation[];
  streamingObs: Map<string, StreamingObservationEntry>;
  loadingFeed: boolean;
  unverifiedCount: number;
  canVerify: boolean;
  onVerify: (observationId: string) => Promise<void>;
  onReject: (observationId: string) => Promise<void>;
  onAddToIncident: (observationId: string) => Promise<void>;
  V: Record<string, string>;
}

export function VisionIntelligenceFeed({
  observations,
  streamingObs,
  loadingFeed,
  unverifiedCount,
  canVerify,
  onVerify,
  onReject,
  onAddToIncident,
  V,
}: FeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "unverified" | "verified" | "relevant">("all");

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [observations.length, streamingObs.size]);

  const filtered = observations.filter((obs) => {
    if (filter === "unverified") return obs.verificationStatus === "unverified";
    if (filter === "verified") return obs.verificationStatus === "verified";
    if (filter === "relevant") return obs.correlationSummary !== undefined;
    return true;
  });

  if (loadingFeed) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: V.muted,
          fontSize: 12,
        }}
      >
        Connecting Rapid Vision™…
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes visionPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes visionBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <div
        style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${V.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, color: V.muted, flexShrink: 0 }}>
          {unverifiedCount > 0
            ? `${unverifiedCount} observation${unverifiedCount !== 1 ? "s" : ""} awaiting review`
            : observations.length > 0
              ? "All observations reviewed"
              : "Watching authorized cameras…"}
        </span>
        <div style={{ flex: 1 }} />
        {(["all", "unverified", "relevant", "verified"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            style={{
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: 4,
              border: `1px solid ${filter === id ? V.vision : V.border}`,
              background: filter === id ? `${V.vision}18` : "transparent",
              color: filter === id ? V.vision : V.muted,
              cursor: "pointer",
              fontWeight: filter === id ? 700 : 400,
              textTransform: "capitalize",
            }}
          >
            {id === "relevant" ? "Correlated" : id}
          </button>
        ))}
      </div>
      <div ref={feedRef} style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {[...streamingObs.entries()].map(([id, entry]) => (
          <StreamingObservationCard key={id} observationId={id} entry={entry} V={V} />
        ))}
        {filtered.length === 0 && streamingObs.size === 0 ? (
          <EmptyFeedState filter={filter} V={V} />
        ) : (
          filtered.map((obs) => (
            <ObservationCard
              key={obs.observationId}
              observation={obs}
              canVerify={canVerify}
              onVerify={onVerify}
              onReject={onReject}
              onAddToIncident={onAddToIncident}
              V={V}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StreamingObservationCard({
  entry,
  V,
}: {
  observationId: string;
  entry: StreamingObservationEntry;
  V: Record<string, string>;
}) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const displayText = entry.text
    .split("\n")
    .filter(
      (l) =>
        !l.startsWith("CATEGORY:") &&
        !l.startsWith("CONFIDENCE:") &&
        !l.startsWith("CORRELATION_NOTE:"),
    )
    .join(" ")
    .trim();

  return (
    <div
      style={{
        margin: "0 10px 6px",
        padding: "9px 11px",
        background: `${V.vision}08`,
        border: `1px solid ${V.vision}40`,
        borderLeft: `3px solid ${V.vision}`,
        borderRadius: 7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: V.vision,
                animation: `visionPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: V.vision, letterSpacing: "0.05em" }}>
          AI WRITING
        </span>
        <span style={{ fontSize: 9, color: V.muted }}>{entry.cameraName}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: V.muted }}>{time}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: V.text, minHeight: 18 }}>
        {displayText}
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: 13,
            background: V.vision,
            marginLeft: 2,
            verticalAlign: "middle",
            animation: "visionBlink 0.8s step-end infinite",
          }}
        />
      </p>
    </div>
  );
}

function ObservationCard({
  observation: obs,
  canVerify,
  onVerify,
  onReject,
  onAddToIncident,
  V,
}: {
  observation: VisionObservation;
  canVerify: boolean;
  onVerify: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onAddToIncident: (id: string) => Promise<void>;
  V: Record<string, string>;
}) {
  const [busy, setBusy] = useState<"verify" | "reject" | "add" | null>(null);
  const isDemo = obs.provider === "demo";
  const isVerified = obs.verificationStatus === "verified";
  const isRejected = obs.verificationStatus === "rejected";
  const hasCorrelation = Boolean(obs.correlationSummary);
  const time = new Date(obs.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const borderColor = isVerified
    ? V.verified
    : isRejected
      ? V.rejected
      : hasCorrelation
        ? V.vision
        : obs.confidence === "HIGH"
          ? V.unverified
          : V.border;

  const handle = async (action: "verify" | "reject" | "add", fn: () => Promise<void>) => {
    setBusy(action);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        margin: "0 10px 6px",
        background: isRejected ? `${V.bg}60` : hasCorrelation ? V.visionGlow : V.surfaceRaised,
        border: `1px solid ${V.border}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 7,
        opacity: isRejected ? 0.45 : 1,
      }}
    >
      <div
        style={{
          padding: "7px 10px 5px",
          display: "flex",
          alignItems: "center",
          gap: 7,
          borderBottom: `1px solid ${V.border}`,
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: isDemo ? V.muted : isVerified ? V.verified : isRejected ? V.rejected : V.unverified,
            letterSpacing: "0.04em",
          }}
        >
          {isDemo ? "DEMO" : isVerified ? "✓ VERIFIED" : isRejected ? "✗ REJECTED" : "AI · UNVERIFIED"}
        </span>
        <span style={{ fontSize: 8, fontWeight: 700, color: V.muted }}>{obs.confidence}</span>
        <span style={{ fontSize: 9, color: V.muted, fontWeight: 600 }}>
          {String(obs.category).replace(/_/g, " ")}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: V.muted }}>{time}</span>
      </div>
      <div style={{ padding: "8px 10px 6px" }}>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: isRejected ? V.muted : V.text }}>
          {obs.narrative}
        </p>
        {hasCorrelation && !isRejected ? (
          <div
            style={{
              marginTop: 6,
              padding: "5px 8px",
              background: `${V.vision}14`,
              border: `1px solid ${V.visionDim}`,
              borderRadius: 5,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: V.vision,
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: 2,
              }}
            >
              ↔ POSSIBLE CORRELATION
            </span>
            <span style={{ fontSize: 10, color: V.vision, lineHeight: 1.4 }}>
              {obs.correlationSummary}
            </span>
          </div>
        ) : null}
        {isDemo ? (
          <div style={{ marginTop: 5, fontSize: 9, color: V.muted, fontStyle: "italic" }}>
            Demo simulation — not a real camera or real event
          </div>
        ) : null}
      </div>
      {!isVerified && !isRejected && canVerify ? (
        <div
          style={{
            padding: "5px 10px 7px",
            display: "flex",
            gap: 6,
            borderTop: `1px solid ${V.border}`,
          }}
        >
          <ActionButton
            label="✓ VERIFY"
            color={V.verified}
            busy={busy === "verify"}
            onClick={() => handle("verify", () => onVerify(obs.observationId))}
          />
          <ActionButton
            label="✗ REJECT"
            color={V.rejected}
            busy={busy === "reject"}
            onClick={() => handle("reject", () => onReject(obs.observationId))}
          />
        </div>
      ) : null}
      {isVerified && canVerify ? (
        <div
          style={{
            padding: "5px 10px 7px",
            borderTop: `1px solid ${V.border}`,
            display: "flex",
            gap: 6,
          }}
        >
          <span style={{ fontSize: 9, color: V.verified, fontWeight: 700 }}>✓ Verified</span>
          <div style={{ flex: 1 }} />
          <ActionButton
            label="+ ADD TO INCIDENT"
            color={V.vision}
            busy={busy === "add"}
            onClick={() => handle("add", () => onAddToIncident(obs.observationId))}
          />
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  color,
  busy,
  onClick,
}: {
  label: string;
  color: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: busy ? "#555" : color,
        background: "transparent",
        border: `1px solid ${busy ? "#333" : color}40`,
        borderRadius: 4,
        padding: "3px 8px",
        cursor: busy ? "not-allowed" : "pointer",
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}

function EmptyFeedState({ filter, V }: { filter: string; V: Record<string, string> }) {
  const messages: Record<string, { title: string; sub: string }> = {
    all: {
      title: "Watching authorized cameras…",
      sub: "Claude is analyzing active video sessions. Observations will appear here.",
    },
    unverified: { title: "No unverified observations", sub: "All observations have been reviewed." },
    relevant: {
      title: "No correlated observations yet",
      sub: "Observations that match caller descriptions will appear here.",
    },
    verified: {
      title: "No verified observations",
      sub: "Verify AI observations to attach them to this incident.",
    },
  };
  const msg = messages[filter] ?? messages.all!;
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        gap: 8,
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, color: V.muted, fontWeight: 500 }}>{msg.title}</p>
      <p style={{ margin: 0, fontSize: 11, color: V.dim, maxWidth: 280, lineHeight: 1.5 }}>{msg.sub}</p>
    </div>
  );
}
