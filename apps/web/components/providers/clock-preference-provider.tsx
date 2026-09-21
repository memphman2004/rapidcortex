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
  DEFAULT_CLOCK_FORMAT,
  hour12FromClockFormat,
  isClockFormat,
  setActiveClockHour12,
  type ClockFormat,
} from "@/lib/clock-format";

export const RC_CLOCK_FORMAT_STORAGE_KEY = "rc-clock-format" as const;

export function clockFormatStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${RC_CLOCK_FORMAT_STORAGE_KEY}:user:${id}` : RC_CLOCK_FORMAT_STORAGE_KEY;
}

function parseClockFormat(raw: string | null | undefined): ClockFormat {
  const value = (raw ?? "").trim();
  if (isClockFormat(value)) return value;
  if (value === "12h" || value === "hour12") return "12";
  if (value === "24h" || value === "hour24") return "24";
  return DEFAULT_CLOCK_FORMAT;
}

function readStoredClockFormat(userId?: string | null): ClockFormat {
  if (typeof window === "undefined") return DEFAULT_CLOCK_FORMAT;
  const keyed = clockFormatStorageKey(userId);
  const perUser = window.localStorage.getItem(keyed);
  if (perUser) return parseClockFormat(perUser);
  const legacy = window.localStorage.getItem(RC_CLOCK_FORMAT_STORAGE_KEY);
  if (legacy && userId) {
    const format = parseClockFormat(legacy);
    try {
      window.localStorage.setItem(keyed, format);
    } catch {
      /* ignore quota / private mode */
    }
    return format;
  }
  return parseClockFormat(legacy);
}

function applyClockFormatToDocument(format: ClockFormat): void {
  document.documentElement.dataset.rcClock = format;
  setActiveClockHour12(hour12FromClockFormat(format));
}

type ClockPreferenceContextValue = {
  clockFormat: ClockFormat;
  hour12: boolean;
  setClockFormat: (format: ClockFormat) => void;
};

const ClockPreferenceContext = createContext<ClockPreferenceContextValue | null>(null);

export function ClockPreferenceProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [clockFormat, setClockFormatState] = useState<ClockFormat>(DEFAULT_CLOCK_FORMAT);

  useEffect(() => {
    const next = readStoredClockFormat(userId);
    setClockFormatState(next);
    applyClockFormatToDocument(next);
  }, [userId]);

  useEffect(() => {
    applyClockFormatToDocument(clockFormat);
  }, [clockFormat]);

  const setClockFormat = useCallback(
    (next: ClockFormat) => {
      try {
        window.localStorage.setItem(clockFormatStorageKey(userId), next);
      } catch {
        /* ignore quota / private mode */
      }
      setClockFormatState(next);
      applyClockFormatToDocument(next);
    },
    [userId],
  );

  const value = useMemo(
    () => ({
      clockFormat,
      hour12: hour12FromClockFormat(clockFormat),
      setClockFormat,
    }),
    [clockFormat, setClockFormat],
  );

  return <ClockPreferenceContext.Provider value={value}>{children}</ClockPreferenceContext.Provider>;
}

export function useClockPreference(): ClockPreferenceContextValue {
  const ctx = useContext(ClockPreferenceContext);
  if (!ctx) {
    throw new Error("useClockPreference must be used within ClockPreferenceProvider");
  }
  return ctx;
}
