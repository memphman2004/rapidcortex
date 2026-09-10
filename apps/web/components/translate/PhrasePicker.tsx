"use client";

import { useState } from "react";
import type { TranslatePhrase, TranslateVertical } from "rapid-cortex-shared";
import { phrasesForVertical } from "rapid-cortex-shared";
import type { TranslateTheme } from "@/lib/translate/translate-theme";

export function PhrasePicker({
  vertical,
  theme,
  onSelectPhrase,
  onClose,
}: {
  vertical: TranslateVertical;
  theme: TranslateTheme;
  onSelectPhrase: (phrase: TranslatePhrase) => void;
  onClose: () => void;
}) {
  const phrases = phrasesForVertical(vertical);
  const categories = [...new Set(phrases.map((p) => p.category))];
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "general");
  const filtered = phrases.filter((p) => p.category === activeCategory);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: `${theme.bg}f5`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: `1px solid ${theme.border}`,
        }}
      >
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>
          Quick phrases
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{ color: theme.textMuted, fontSize: 18, background: "none", border: "none", cursor: "pointer" }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 14px",
          borderBottom: `1px solid ${theme.border}`,
          overflowX: "auto",
        }}
      >
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontFamily: "monospace",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: `1px solid ${activeCategory === cat ? theme.primaryColor : theme.border}`,
              background: activeCategory === cat ? `${theme.primaryColor}20` : "transparent",
              color: activeCategory === cat ? theme.primaryColor : theme.textMuted,
              whiteSpace: "nowrap",
            }}
          >
            {cat}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.map((phrase) => (
          <button
            key={phrase.id}
            type="button"
            onClick={() => {
              onSelectPhrase(phrase);
              onClose();
            }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "12px 16px",
              borderBottom: `1px solid ${theme.border}50`,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>{phrase.label}</span>
            <span style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
              {phrase.text.length > 80 ? `${phrase.text.slice(0, 80)}…` : phrase.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
