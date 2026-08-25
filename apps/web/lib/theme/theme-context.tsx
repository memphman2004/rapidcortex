"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type RcTheme = "dark" | "light";

const RC_THEME_EVENT = "rc-theme-change";

interface ThemeContextValue {
  theme: RcTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

function isRcTheme(value: string | null | undefined): value is RcTheme {
  return value === "light" || value === "dark";
}

function readStoredTheme(storageKey: string, fallback: RcTheme): RcTheme {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(storageKey);
  return isRcTheme(stored) ? stored : fallback;
}

function broadcastTheme(storageKey: string, theme: RcTheme) {
  localStorage.setItem(storageKey, theme);
  window.dispatchEvent(new CustomEvent(RC_THEME_EVENT, { detail: { storageKey, theme } }));
}

/**
 * Wraps a dashboard shell (not the app root) with independent theme state.
 * Persist per shell via `storageKey` (e.g. rc-theme-venue, rc-theme-admin).
 */
export function ThemeProvider({
  children,
  storageKey,
  defaultTheme = "dark",
}: {
  children: ReactNode;
  storageKey: string;
  defaultTheme?: RcTheme;
}) {
  const [theme, setTheme] = useState<RcTheme>(() => readStoredTheme(storageKey, defaultTheme));

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string; theme?: string }>).detail;
      const next = detail?.theme;
      if (detail?.storageKey !== storageKey || !isRcTheme(next)) return;
      setTheme(next);
    };
    window.addEventListener(RC_THEME_EVENT, onChange);
    return () => window.removeEventListener(RC_THEME_EVENT, onChange);
  }, [storageKey]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: RcTheme = prev === "dark" ? "light" : "dark";
      broadcastTheme(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Attach `rootRef` to the shell root. Sets `data-theme` so CSS variables
 * stay scoped to this shell (dashboards can differ independently).
 */
export function useThemeRoot<T extends HTMLElement = HTMLDivElement>() {
  const { theme, toggleTheme } = useTheme();
  const rootRef = useRef<T>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.setAttribute("data-theme", theme);
    el.style.colorScheme = theme;
  }, [theme]);

  return { theme, toggleTheme, rootRef };
}
