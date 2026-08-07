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
import { useSession } from "@/components/auth/session-context";

export const RC_PREFERRED_FONT_STORAGE_KEY = "rc-preferred-font" as const;

export type PreferredDashboardFont =
  | "inter"
  | "modern"
  | "poppins"
  | "roboto"
  | "ibm_plex_sans"
  | "open_sans"
  | "manrope"
  | "source_sans_pro";

export const PREFERRED_DASHBOARD_FONTS: readonly PreferredDashboardFont[] = [
  "inter",
  "modern",
  "poppins",
  "roboto",
  "ibm_plex_sans",
  "open_sans",
  "manrope",
  "source_sans_pro",
] as const;

export const PREFERRED_DASHBOARD_FONT_LABELS: Record<PreferredDashboardFont, string> = {
  inter: "Inter",
  modern: "Modern",
  poppins: "Poppins",
  roboto: "Roboto",
  ibm_plex_sans: "IBM Plex Sans",
  open_sans: "Open Sans",
  manrope: "Manrope",
  source_sans_pro: "Source Sans Pro",
};

const FONT_STACK: Record<PreferredDashboardFont, string> = {
  inter: "var(--font-inter), Inter, ui-sans-serif, system-ui, sans-serif",
  modern: "var(--font-modern), \"DM Sans\", ui-sans-serif, system-ui, sans-serif",
  poppins: "var(--font-poppins), Poppins, ui-sans-serif, system-ui, sans-serif",
  roboto: "var(--font-roboto), Roboto, ui-sans-serif, system-ui, sans-serif",
  ibm_plex_sans:
    "var(--font-ibm-plex-sans), \"IBM Plex Sans\", ui-sans-serif, system-ui, sans-serif",
  open_sans: "var(--font-open-sans), \"Open Sans\", ui-sans-serif, system-ui, sans-serif",
  manrope: "var(--font-manrope), Manrope, ui-sans-serif, system-ui, sans-serif",
  source_sans_pro:
    "var(--font-source-sans), \"Source Sans 3\", \"Source Sans Pro\", ui-sans-serif, system-ui, sans-serif",
};

const LEGACY_REMOVED = new Set(["courier", "times", "arial", "times new roman", "courier new"]);

function isPreferredFont(value: string): value is PreferredDashboardFont {
  return (PREFERRED_DASHBOARD_FONTS as readonly string[]).includes(value);
}

export function preferredFontStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${RC_PREFERRED_FONT_STORAGE_KEY}:user:${id}` : RC_PREFERRED_FONT_STORAGE_KEY;
}

function parseFontValue(raw: string | null | undefined): PreferredDashboardFont {
  const value = (raw ?? "").toLowerCase().trim();
  const normalized = value.replace(/[\s-]+/g, "_");
  if (isPreferredFont(normalized)) return normalized;
  if (normalized === "sourcesanspro" || normalized === "source_sans") return "source_sans_pro";
  if (normalized === "ibmplexsans" || normalized === "ibm_plex") return "ibm_plex_sans";
  if (normalized === "opensans") return "open_sans";
  if (LEGACY_REMOVED.has(value) || LEGACY_REMOVED.has(normalized.replace(/_/g, " "))) {
    return "inter";
  }
  return "inter";
}

function readStoredFont(userId?: string | null): PreferredDashboardFont {
  if (typeof window === "undefined") return "inter";
  const keyed = preferredFontStorageKey(userId);
  const perUser = window.localStorage.getItem(keyed);
  if (perUser) return parseFontValue(perUser);
  // Migrate once from the legacy global key into the user-scoped key.
  const legacy = window.localStorage.getItem(RC_PREFERRED_FONT_STORAGE_KEY);
  if (legacy && userId) {
    const font = parseFontValue(legacy);
    try {
      window.localStorage.setItem(keyed, font);
    } catch {
      /* ignore */
    }
    return font;
  }
  return parseFontValue(legacy);
}

function applyFontToDocument(font: PreferredDashboardFont): void {
  const stack = FONT_STACK[font];
  document.documentElement.style.setProperty("--rc-dashboard-font-family", stack);
  document.body.style.fontFamily = stack;
}

type FontPreferenceContextValue = {
  font: PreferredDashboardFont;
  setFont: (font: PreferredDashboardFont) => void;
};

const FontPreferenceContext = createContext<FontPreferenceContextValue | null>(null);

export function FontPreferenceProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [font, setFontState] = useState<PreferredDashboardFont>("inter");

  useEffect(() => {
    const next = readStoredFont(userId);
    setFontState(next);
    applyFontToDocument(next);
  }, [userId]);

  useEffect(() => {
    applyFontToDocument(font);
  }, [font]);

  const setFont = useCallback(
    (next: PreferredDashboardFont) => {
      try {
        window.localStorage.setItem(preferredFontStorageKey(userId), next);
      } catch {
        /* ignore quota / private mode */
      }
      setFontState(next);
      applyFontToDocument(next);
    },
    [userId],
  );

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
