"use client";

import { SUPPORTED_LANGUAGES } from "rapid-cortex-shared";
import type { TranslateTheme } from "@/lib/translate/translate-theme";

export function LanguageSelector({
  value,
  onChange,
  theme,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  theme: TranslateTheme;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: theme.surface,
        color: theme.textPrimary,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
