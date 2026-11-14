"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-context";

/**
 * variant="inline" — shells using CSS var / inline styles (Venue, Campus, Dispatcher)
 * variant="tailwind" — NexCort Admin / Tailwind shells
 *
 * Always uses primary text on a solid surface so the label stays readable after
 * dark ↔ light switches (including while the button is hovered/active/focused).
 */
export function ThemeToggle({
  variant: _variant = "inline",
}: {
  /** Kept for call-site compatibility; both variants share the contrast-safe chip styles. */
  variant?: "inline" | "tailwind";
}) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Light" : "Dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Switch to ${label.toLowerCase()} mode`}
      aria-label={`Switch to ${label.toLowerCase()} mode`}
      className="rc-theme-toggle flex select-none items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide transition-colors"
    >
      {isDark ? <Sun size={12} strokeWidth={2.25} aria-hidden /> : <Moon size={12} strokeWidth={2.25} aria-hidden />}
      <span>{label.toUpperCase()}</span>
    </button>
  );
}
