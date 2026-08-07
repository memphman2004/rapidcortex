"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-context";

/**
 * variant="inline" — shells using CSS var / inline styles (Venue, Campus, Dispatcher)
 * variant="tailwind" — RC Admin / Tailwind shells
 */
export function ThemeToggle({
  variant = "inline",
}: {
  variant?: "inline" | "tailwind";
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Light" : "Dark";

  if (variant === "tailwind") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        title={`Switch to ${label.toLowerCase()} mode`}
        className="flex select-none items-center gap-1.5 rounded-md border border-rc-border bg-rc-surface px-2 py-1 text-[11px] font-semibold tracking-wide text-rc-secondary transition-colors hover:border-rc-border-strong hover:bg-rc-surface-alt hover:text-rc-text"
      >
        {isDark ? <Sun size={12} strokeWidth={2} /> : <Moon size={12} strokeWidth={2} />}
        {label.toUpperCase()}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${label.toLowerCase()} mode`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 6,
        border: "1px solid var(--rc-border)",
        background: "transparent",
        color: "var(--rc-text-secondary)",
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        letterSpacing: "0.04em",
        userSelect: "none",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
      }}
      onMouseEnter={(e) => {
        const b = e.currentTarget;
        b.style.background = "var(--rc-surface-hover)";
        b.style.color = "var(--rc-text-primary)";
        b.style.borderColor = "var(--rc-border-hover)";
      }}
      onMouseLeave={(e) => {
        const b = e.currentTarget;
        b.style.background = "transparent";
        b.style.color = "var(--rc-text-secondary)";
        b.style.borderColor = "var(--rc-border)";
      }}
    >
      {isDark ? <Sun size={12} strokeWidth={2} /> : <Moon size={12} strokeWidth={2} />}
      <span>{label.toUpperCase()}</span>
    </button>
  );
}
