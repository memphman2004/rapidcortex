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
import {
  USER_TEXT_ROLES,
  USER_TEXT_WRITABLE_VARS,
  cssVarForRole,
  emptyUserTextPrefs,
  parseUserTextPrefs,
  type UserTextColorPrefs,
  type UserTextMode,
  type UserTextRole,
} from "@/lib/theme/user-text-palette";

export const RC_UI_FONT_SCALE_STORAGE_KEY = "rc-ui-font-scale" as const;
export const RC_USER_TEXT_COLORS_STORAGE_KEY = "rc-user-text-colors" as const;

export const FONT_SCALE_STEPS = [0.875, 1, 1.125, 1.25, 1.375] as const;
export type FontScaleStep = (typeof FONT_SCALE_STEPS)[number];

function isFontScaleStep(value: number): value is FontScaleStep {
  return (FONT_SCALE_STEPS as readonly number[]).includes(value);
}

function clampFontScale(value: number): FontScaleStep {
  if (isFontScaleStep(value)) return value;
  let nearest: FontScaleStep = 1;
  let delta = Number.POSITIVE_INFINITY;
  for (const step of FONT_SCALE_STEPS) {
    const d = Math.abs(step - value);
    if (d < delta) {
      nearest = step;
      delta = d;
    }
  }
  return nearest;
}

function scopedKey(base: string, userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${base}:user:${id}` : base;
}

function readFontScale(userId?: string | null): FontScaleStep {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(scopedKey(RC_UI_FONT_SCALE_STORAGE_KEY, userId));
  const parsed = raw ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(parsed) ? clampFontScale(parsed) : 1;
}

function readTextPrefs(userId?: string | null): UserTextColorPrefs {
  if (typeof window === "undefined") return emptyUserTextPrefs();
  try {
    const raw = window.localStorage.getItem(scopedKey(RC_USER_TEXT_COLORS_STORAGE_KEY, userId));
    return parseUserTextPrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyUserTextPrefs();
  }
}

function applyFontScale(scale: FontScaleStep): void {
  document.documentElement.style.setProperty("--rc-ui-font-scale", String(scale));
}

function applyTextPrefs(prefs: UserTextColorPrefs): void {
  const root = document.documentElement;
  for (const mode of ["dark", "light"] as const) {
    for (const role of USER_TEXT_ROLES) {
      const name = cssVarForRole(mode, role);
      const hex = prefs[mode][role];
      if (hex) root.style.setProperty(name, hex);
      else root.style.removeProperty(name);
    }
  }
}

function stepIndex(scale: FontScaleStep): number {
  return FONT_SCALE_STEPS.indexOf(scale);
}

type TypographyPreferenceContextValue = {
  fontScale: FontScaleStep;
  canDecreaseFont: boolean;
  canIncreaseFont: boolean;
  decreaseFont: () => void;
  increaseFont: () => void;
  resetFontScale: () => void;
  textColors: UserTextColorPrefs;
  setRoleColor: (mode: UserTextMode, role: UserTextRole, hex: string | null) => void;
  resetMode: (mode: UserTextMode) => void;
  resetAllTextColors: () => void;
};

const TypographyPreferenceContext = createContext<TypographyPreferenceContextValue | null>(null);

export function TypographyPreferenceProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [fontScale, setFontScaleState] = useState<FontScaleStep>(1);
  const [textColors, setTextColorsState] = useState<UserTextColorPrefs>(emptyUserTextPrefs);

  useEffect(() => {
    const scale = readFontScale(userId);
    const colors = readTextPrefs(userId);
    setFontScaleState(scale);
    setTextColorsState(colors);
    applyFontScale(scale);
    applyTextPrefs(colors);
  }, [userId]);

  const persistScale = useCallback(
    (next: FontScaleStep) => {
      try {
        window.localStorage.setItem(scopedKey(RC_UI_FONT_SCALE_STORAGE_KEY, userId), String(next));
      } catch {
        /* ignore quota / private mode */
      }
      setFontScaleState(next);
      applyFontScale(next);
    },
    [userId],
  );

  const persistColors = useCallback(
    (next: UserTextColorPrefs) => {
      try {
        window.localStorage.setItem(scopedKey(RC_USER_TEXT_COLORS_STORAGE_KEY, userId), JSON.stringify(next));
      } catch {
        /* ignore quota / private mode */
      }
      setTextColorsState(next);
      applyTextPrefs(next);
    },
    [userId],
  );

  const decreaseFont = useCallback(() => {
    const i = stepIndex(fontScale);
    const prev = FONT_SCALE_STEPS[Math.max(0, i - 1)];
    if (prev) persistScale(prev);
  }, [fontScale, persistScale]);

  const increaseFont = useCallback(() => {
    const i = stepIndex(fontScale);
    const next = FONT_SCALE_STEPS[Math.min(FONT_SCALE_STEPS.length - 1, i + 1)];
    if (next) persistScale(next);
  }, [fontScale, persistScale]);

  const resetFontScale = useCallback(() => persistScale(1), [persistScale]);

  const setRoleColor = useCallback(
    (mode: UserTextMode, role: UserTextRole, hex: string | null) => {
      persistColors({
        ...textColors,
        [mode]: hex
          ? { ...textColors[mode], [role]: hex }
          : (() => {
              const copy = { ...textColors[mode] };
              delete copy[role];
              return copy;
            })(),
      });
    },
    [persistColors, textColors],
  );

  const resetMode = useCallback(
    (mode: UserTextMode) => {
      persistColors({ ...textColors, [mode]: {} });
    },
    [persistColors, textColors],
  );

  const resetAllTextColors = useCallback(() => persistColors(emptyUserTextPrefs()), [persistColors]);

  const value = useMemo(
    () => ({
      fontScale,
      canDecreaseFont: fontScale !== FONT_SCALE_STEPS[0],
      canIncreaseFont: fontScale !== FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1],
      decreaseFont,
      increaseFont,
      resetFontScale,
      textColors,
      setRoleColor,
      resetMode,
      resetAllTextColors,
    }),
    [
      decreaseFont,
      fontScale,
      increaseFont,
      resetAllTextColors,
      resetFontScale,
      resetMode,
      setRoleColor,
      textColors,
    ],
  );

  return (
    <TypographyPreferenceContext.Provider value={value}>{children}</TypographyPreferenceContext.Provider>
  );
}

export function useTypographyPreference(): TypographyPreferenceContextValue {
  const ctx = useContext(TypographyPreferenceContext);
  if (!ctx) {
    throw new Error("useTypographyPreference must be used within TypographyPreferenceProvider");
  }
  return ctx;
}

/** Test helper — writable var names this provider is allowed to touch. */
export function typographyWritableCssVars(): readonly string[] {
  return USER_TEXT_WRITABLE_VARS;
}
