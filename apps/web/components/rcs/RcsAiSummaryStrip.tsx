"use client";

import type { RcsAiSummary } from "rapid-cortex-shared";
import { RCS_SURFACE } from "@/lib/rcs/rcs-colors";
import { formatElapsed } from "./rcs-ui-utils";

export type RcsAiSummaryStripProps = {
  summary?: RcsAiSummary | null;
  compact?: boolean;
};

export function RcsAiSummaryStrip({ summary, compact = false }: RcsAiSummaryStripProps) {
  if (!summary?.text) {
    return (
      <div
        style={{
          fontSize: 11,
          color: RCS_SURFACE.subtleText,
          fontStyle: "italic",
          padding: compact ? "2px 0" : "6px 8px",
        }}
      >
        AI summary pending…
      </div>
    );
  }

  const caution = summary.confidence < 0.6;
  const keywords = summary.concernKeywords?.slice(0, 4) ?? [];

  return (
    <div
      style={{
        borderRadius: 6,
        border: `1px solid ${caution ? "rgba(250, 204, 21, 0.35)" : "rgba(56, 189, 248, 0.25)"}`,
        background: caution ? "rgba(234, 179, 8, 0.08)" : "rgba(14, 165, 233, 0.06)",
        padding: compact ? "6px 8px" : "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: RCS_SURFACE.subtleText }}>
        <span style={{ fontWeight: 700, letterSpacing: 0.4, color: "#7dd3fc" }}>AI SUMMARY</span>
        {caution ? <span style={{ color: "#fde047" }}>Low confidence</span> : null}
        <span style={{ marginLeft: "auto" }}>{formatElapsed(summary.generatedAt)} ago</span>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: RCS_SURFACE.bodyText, lineHeight: 1.4 }}>{summary.text}</p>
      {keywords.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {keywords.map((k) => (
            <span
              key={k}
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 0.3,
                color: "#fdba74",
                background: "rgba(249, 115, 22, 0.12)",
                borderRadius: 4,
                padding: "2px 5px",
              }}
            >
              {k.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
