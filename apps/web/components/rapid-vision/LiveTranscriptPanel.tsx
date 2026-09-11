"use client";

/**
 * Live scene-audio transcript for a Rapid Vision™ session.
 *
 * Tokens from IncidentCameraPanel / KVSWebRTCPlayer:
 *   surface #100e1a  border #1e1a30  text #e4dff5  muted #7c6fa0
 * Vision teal (#06b6d4) is used on the transcript header only.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { VisionTranscriptSegment } from "rapid-cortex-shared";

export type TranscriptSegment = VisionTranscriptSegment;

const C = {
  surface: "#100e1a",
  border: "#1e1a30",
  text: "#e4dff5",
  muted: "#7c6fa0",
  dim: "#3a3460",
  teal: "#06b6d4",
  tealDim: "#0e7490",
  spk: ["#06b6d4", "#f59e0b", "#a78bfa", "#6b7280"] as const,
  live: "#22c55e",
  partial: "#4b4470",
} as const;

function speakerColor(label: string): string {
  const idx = parseInt(label.replace(/\D/g, ""), 10) || 0;
  return C.spk[Math.min(idx, C.spk.length - 1)] ?? C.spk[3];
}

function speakerShort(label: string): string {
  return label.replace("SPEAKER_", "SPK ");
}

interface Props {
  incidentId: string;
  sessionId: string;
  cameraName?: string;
  initialSegments?: TranscriptSegment[];
  transcriptStatus?: "idle" | "starting" | "active" | "stopped";
  loading?: boolean;
  onStart?: () => Promise<void>;
  onStop?: () => Promise<void>;
  style?: CSSProperties;
}

export function LiveTranscriptPanel({
  cameraName,
  initialSegments = [],
  transcriptStatus = "idle",
  loading = false,
  onStart,
  onStop,
  style,
}: Props) {
  const [segments, setSegments] = useState<TranscriptSegment[]>(initialSegments);
  const [userScrolledUp, setScrolled] = useState(false);
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSegments(initialSegments);
  }, [initialSegments]);

  useEffect(() => {
    if (!userScrolledUp) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments, userScrolledUp]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrolled(el.scrollTop + el.clientHeight < el.scrollHeight - 16);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart?.();
    } finally {
      setStarting(false);
    }
  };

  const isActive = transcriptStatus === "active";
  const isIdle = transcriptStatus === "idle" || transcriptStatus === "stopped";
  const isBusy = transcriptStatus === "starting" || starting;
  const grouped = groupBySpeaker(segments);
  const speakers = uniqueSpeakers(segments);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 0,
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        ...style,
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexShrink: 0,
        }}
      >
        <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden>
          <rect
            x="3"
            y="1"
            width="5"
            height="7"
            rx="2.5"
            stroke={isActive ? C.live : C.muted}
            strokeWidth="1.3"
          />
          <path
            d="M1 7c0 2.5 9 2.5 9 0"
            stroke={isActive ? C.live : C.muted}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <path
            d="M5.5 10v2"
            stroke={isActive ? C.live : C.muted}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: isActive ? C.live : C.teal,
          }}
        >
          {isActive ? "● LIVE TRANSCRIPT" : "TRANSCRIPT"}
        </span>
        {cameraName ? <span style={{ fontSize: 9, color: C.dim }}>— {cameraName}</span> : null}
        <div style={{ flex: 1 }} />
        {speakers.length > 1
          ? speakers.slice(0, 4).map((spk) => (
              <span key={spk} style={{ fontSize: 8, fontWeight: 700, color: speakerColor(spk) }}>
                {speakerShort(spk)}
              </span>
            ))
          : null}
        {isActive ? (
          <button type="button" onClick={() => void onStop?.()} style={btnStyle("#7f1d1d", "#fca5a5")}>
            STOP
          </button>
        ) : isIdle ? (
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={isBusy || !onStart}
            style={btnStyle(isBusy ? C.dim : C.tealDim, isBusy ? C.muted : C.teal)}
          >
            {isBusy ? "STARTING…" : "START"}
          </button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ flex: 1, overflowY: "auto", padding: "8px 10px", minHeight: 0 }}
      >
        {loading ? (
          <EmptyMsg text="Loading…" />
        ) : segments.length === 0 ? (
          isActive ? (
            <EmptyMsg text="Listening for audio…" pulsing />
          ) : (
            <EmptyMsg text="Press START to transcribe scene audio." />
          )
        ) : (
          grouped.map((g, i) => <SpeakerGroup key={`${g.speakerLabel}-${i}`} group={g} />)
        )}
        <div ref={bottomRef} />
      </div>

      {userScrolledUp ? (
        <div style={{ padding: "4px 10px", borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => {
              setScrolled(false);
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.teal,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            ↓ LATEST
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface Group {
  speakerLabel: string;
  segments: TranscriptSegment[];
}

function SpeakerGroup({ group }: { group: Group }) {
  const color = speakerColor(group.speakerLabel);
  const last = group.segments[group.segments.length - 1];
  const ts = last
    ? new Date(last.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: "0.04em" }}>
          {speakerShort(group.speakerLabel)}
        </span>
        <span style={{ fontSize: 9, color: C.dim }}>{ts}</span>
      </div>
      <div style={{ paddingLeft: 12 }}>
        {group.segments.map((seg) => (
          <span
            key={seg.resultId}
            style={{
              fontSize: 12,
              lineHeight: 1.6,
              color: seg.isPartial ? C.partial : C.text,
              fontStyle: seg.isPartial ? "italic" : "normal",
              opacity: seg.confidence < 0.55 ? 0.7 : 1,
            }}
          >
            {seg.transcript}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyMsg({ text, pulsing = false }: { text: string; pulsing?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 80,
        gap: 6,
      }}
    >
      {pulsing ? <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.live }} /> : null}
      <span style={{ fontSize: 11, color: C.muted }}>{text}</span>
    </div>
  );
}

function groupBySpeaker(segs: TranscriptSegment[]): Group[] {
  const out: Group[] = [];
  for (const seg of segs) {
    const last = out[out.length - 1];
    if (last?.speakerLabel === seg.speakerLabel) {
      last.segments.push(seg);
    } else {
      out.push({ speakerLabel: seg.speakerLabel, segments: [seg] });
    }
  }
  return out;
}

function uniqueSpeakers(segs: TranscriptSegment[]): string[] {
  const seen = new Set<string>();
  return segs.reduce<string[]>((acc, s) => {
    if (!seen.has(s.speakerLabel)) {
      seen.add(s.speakerLabel);
      acc.push(s.speakerLabel);
    }
    return acc;
  }, []);
}

function btnStyle(borderColor: string, textColor: string): CSSProperties {
  return {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.05em",
    color: textColor,
    background: "transparent",
    border: `1px solid ${borderColor}`,
    borderRadius: 4,
    padding: "2px 7px",
    cursor: "pointer",
  };
}
