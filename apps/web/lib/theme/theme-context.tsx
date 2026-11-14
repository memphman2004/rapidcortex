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
import { useSession } from "@/components/auth/session-context";

export type RcTheme = "dark" | "light";

/** Canonical dashboard theme key (also written unscoped for FOUC script). */
export const RC_THEME_STORAGE_KEY = "rc-theme" as const;

const RC_THEME_EVENT = "rc-theme-change";

/** Legacy per-shell keys — still read once, then migrated to the canonical key. */
const LEGACY_THEME_KEYS = [
  "rc-theme-campus",
  "rc-theme-venue",
  "rc-theme-dispatcher",
  "rc-theme-admin",
  "rc-theme-hospital",
  "rc-theme-transit",
  "rc-theme-call-assist",
  "rc-theme-sales",
] as const;

interface ThemeContextValue {
  theme: RcTheme;
  toggleTheme: () => void;
  setTheme: (theme: RcTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

function isRcTheme(value: string | null | undefined): value is RcTheme {
  return value === "light" || value === "dark";
}

export function themeStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${RC_THEME_STORAGE_KEY}:user:${id}` : RC_THEME_STORAGE_KEY;
}

function readStoredTheme(userId?: string | null, legacyKey?: string): RcTheme {
  if (typeof window === "undefined") return "dark";
  const keyed = themeStorageKey(userId);
  const perUser = window.localStorage.getItem(keyed);
  if (isRcTheme(perUser)) return perUser;

  const global = window.localStorage.getItem(RC_THEME_STORAGE_KEY);
  if (isRcTheme(global)) {
    if (userId) {
      try {
        window.localStorage.setItem(keyed, global);
      } catch {
        /* ignore */
      }
    }
    return global;
  }

  const legacyCandidates = [legacyKey, ...LEGACY_THEME_KEYS].filter(
    (k): k is string => Boolean(k),
  );
  for (const key of legacyCandidates) {
    const legacy = window.localStorage.getItem(key);
    if (isRcTheme(legacy)) {
      try {
        window.localStorage.setItem(RC_THEME_STORAGE_KEY, legacy);
        if (userId) window.localStorage.setItem(keyed, legacy);
      } catch {
        /* ignore */
      }
      return legacy;
    }
  }

  return "dark";
}

export function applyThemeToDocument(theme: RcTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

function persistTheme(theme: RcTheme, userId?: string | null, legacyKey?: string): void {
  try {
    window.localStorage.setItem(RC_THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(themeStorageKey(userId), theme);
    if (legacyKey && legacyKey !== RC_THEME_STORAGE_KEY) {
      window.localStorage.setItem(legacyKey, theme);
    }
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(RC_THEME_EVENT, {
      detail: { storageKey: RC_THEME_STORAGE_KEY, theme, userId: userId ?? null },
    }),
  );
}

/**
 * Dashboard theme — dark/light persists for the signed-in user across every
 * page. `storageKey` is retained for legacy shell migration only.
 */
export function ThemeProvider({
  children,
  storageKey,
  defaultTheme = "dark",
}: {
  children: ReactNode;
  /** @deprecated Legacy per-shell key; preferences now use `rc-theme` (+ user scope). */
  storageKey?: string;
  defaultTheme?: RcTheme;
}) {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [theme, setThemeState] = useState<RcTheme>(defaultTheme);
  const legacyKey = storageKey;

  useEffect(() => {
    const next = readStoredTheme(userId, legacyKey);
    setThemeState(next);
    applyThemeToDocument(next);
  }, [userId, legacyKey]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: string }>).detail;
      const next = detail?.theme;
      if (!isRcTheme(next)) return;
      setThemeState(next);
      applyThemeToDocument(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      const relevant =
        event.key === RC_THEME_STORAGE_KEY ||
        event.key === themeStorageKey(userId) ||
        (legacyKey != null && event.key === legacyKey);
      if (!relevant || !isRcTheme(event.newValue)) return;
      setThemeState(event.newValue);
      applyThemeToDocument(event.newValue);
    };
    const onPageShow = () => {
      const next = readStoredTheme(userId, legacyKey);
      setThemeState(next);
      applyThemeToDocument(next);
    };
    window.addEventListener(RC_THEME_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener(RC_THEME_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [userId, legacyKey]);

  const setTheme = useCallback(
    (next: RcTheme) => {
      setThemeState(next);
      applyThemeToDocument(next);
      persistTheme(next, userId, legacyKey);
    },
    [userId, legacyKey],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: RcTheme = prev === "dark" ? "light" : "dark";
      applyThemeToDocument(next);
      persistTheme(next, userId, legacyKey);
      return next;
    });
  }, [userId, legacyKey]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Attach `rootRef` to the shell root. Mirrors `data-theme` onto the shell so
 * scoped CSS keeps matching; documentElement is the source of truth for persistence.
 */
export function useThemeRoot<T extends HTMLElement = HTMLDivElement>() {
  const { theme, toggleTheme, setTheme } = useTheme();
  const rootRef = useRef<T>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.setAttribute("data-theme", theme);
    el.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  return { theme, toggleTheme, setTheme, rootRef };
}
