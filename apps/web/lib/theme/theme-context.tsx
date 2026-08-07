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

interface ThemeContextValue {
  theme: RcTheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

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
  const [theme, setTheme] = useState<RcTheme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    const stored = localStorage.getItem(storageKey);
    return stored === "light" || stored === "dark" ? stored : defaultTheme;
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: RcTheme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(storageKey, next);
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
