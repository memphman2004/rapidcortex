"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const RC_PREFERRED_FONT_STORAGE_KEY = "rc-preferred-font" as const;

export type PreferredDashboardFont = "courier" | "inter" | "times" | "arial";

const FONT_STACK: Record<PreferredDashboardFont, string> = {
  courier: '"Courier New", Courier, monospace',
  inter: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
  times: '"Times New Roman", Times, serif',
  arial: "Arial, Helvetica, sans-serif",
};

function readStoredFont(): PreferredDashboardFont {
  if (typeof window === "undefined") return "courier";
  const raw = window.localStorage.getItem(RC_PREFERRED_FONT_STORAGE_KEY)?.toLowerCase().trim();
  if (raw === "times" || raw === "times new roman" || raw === "timesnewroman") return "times";
  if (raw === "arial") return "arial";
  if (raw === "inter") return "inter";
  if (raw === "courier" || raw === "courier new" || raw === "couriernew") return "courier";
  return "courier";
}

function applyFontToDocument(font: PreferredDashboardFont): void {
  const stack = FONT_STACK[font];
  document.documentElement.style.setProperty("--rc-dashboard-font-family", stack);
  document.body.style.fontFamily = stack; /* applies globally; mirrors CSS variable */
}

type FontPreferenceContextValue = {
  font: PreferredDashboardFont;
  setFont: (font: PreferredDashboardFont) => void;
};

const FontPreferenceContext = createContext<FontPreferenceContextValue | null>(null);

export function FontPreferenceProvider({ children }: { children: ReactNode }) {
  const [font, setFontState] = useState<PreferredDashboardFont>("courier");

  useEffect(() => {
    setFontState(readStoredFont());
  }, []);

  useEffect(() => {
    applyFontToDocument(font);
  }, [font]);

  const setFont = useCallback((next: PreferredDashboardFont) => {
    try {
      window.localStorage.setItem(RC_PREFERRED_FONT_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
    setFontState(next);
    applyFontToDocument(next);
  }, []);

  const value = useMemo(() => ({ font, setFont }), [font, setFont]);

  return <FontPreferenceContext.Provider value={value}>{children}</FontPreferenceContext.Provider>;
}

export function useFontPreference(): FontPreferenceContextValue {
  const ctx = useContext(FontPreferenceContext);
  if (!ctx) {
    throw new Error("useFontPreference must be used within FontPreferenceProvider");
  }
  return ctx;
}
