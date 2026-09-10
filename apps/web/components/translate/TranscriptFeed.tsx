"use client";

import { TRANSLATE_SPEAKER_LABELS, type TranslateVertical } from "rapid-cortex-shared";
import type { TranslateTheme } from "@/lib/translate/translate-theme";
import type { FeedItem } from "@/lib/translate/use-translate-session";

export function TranscriptFeed({
  items,
  vertical,
  theme,
}: {
  items: FeedItem[];
  vertical: TranslateVertical;
  theme: TranslateTheme;
}) {
  const labels = TRANSLATE_SPEAKER_LABELS[vertical];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, overflowY: "auto", flex: 1 }}>
      {items.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: 13, margin: 0 }}>No exchanges yet.</p>
      ) : (
        items.map((item) => {
          const primary = item.speaker === "officer";
          return (
            <div
              key={item.segmentId}
              style={{
                alignSelf: primary ? "flex-start" : "flex-end",
                maxWidth: "86%",
                background: primary ? theme.primaryBubbleBg : theme.secondaryBubbleBg,
                border: `1px solid ${primary ? theme.primaryBubbleBorder : theme.secondaryBubbleBorder}`,
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: primary ? theme.primaryColor : theme.secondaryColor,
                  marginBottom: 4,
                }}
              >
                {primary ? labels.primary : labels.secondary}
              </div>
              <div style={{ color: theme.textPrimary, fontSize: 14 }}>{item.originalText}</div>
              {item.translatedText ? (
                <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 6 }}>{item.translatedText}</div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
