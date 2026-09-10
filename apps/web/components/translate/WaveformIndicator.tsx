"use client";

import type { TranslateTheme } from "@/lib/translate/translate-theme";

export function WaveformIndicator({
  active,
  theme,
  label,
}: {
  active: boolean;
  theme: TranslateTheme;
  label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: theme.textMuted, fontSize: 12 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          background: active ? theme.sweepPrimary : theme.border,
          boxShadow: active ? `0 0 10px ${theme.sweepPrimary}` : "none",
        }}
      />
      {label}
    </div>
  );
}
