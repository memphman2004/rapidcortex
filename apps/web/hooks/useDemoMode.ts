"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DemoSession = {
  active: boolean;
  activatedAt: number;
  expiresAt: number;
  activatedBy: string;
  remainingMs: number;
  remainingLabel: string;
};

const DEMO_DURATION_MS = 2 * 60 * 60 * 1000;
const STORAGE_KEY = "rc_demo_session";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function auditDemo(body: Record<string, unknown>) {
  try {
    await fetch("/api/security/demo-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "include",
    });
  } catch {
    /* ignore */
  }
}

export function useDemoMode(userEmail: string) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as DemoSession;
      if (Date.now() < parsed.expiresAt) {
        setSession({
          ...parsed,
          remainingMs: parsed.expiresAt - Date.now(),
          remainingLabel: formatRemaining(parsed.expiresAt - Date.now()),
        });
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!session?.active) {
      clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev) return null;
        const remainingMs = prev.expiresAt - Date.now();
        if (remainingMs <= 0) {
          clearInterval(tickRef.current);
          sessionStorage.removeItem(STORAGE_KEY);
          void auditDemo({ action: "expired", email: prev.activatedBy });
          return null;
        }
        return { ...prev, remainingMs, remainingLabel: formatRemaining(remainingMs) };
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [session?.active]);

  const start = useCallback(
    async (durationMs = DEMO_DURATION_MS) => {
      const now = Date.now();
      const newSession: DemoSession = {
        active: true,
        activatedAt: now,
        expiresAt: now + durationMs,
        activatedBy: userEmail,
        remainingMs: durationMs,
        remainingLabel: formatRemaining(durationMs),
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      await auditDemo({
        action: "started",
        email: userEmail,
        durationMs,
        pageUrl: window.location.href,
      });
    },
    [userEmail],
  );

  const stop = useCallback(async () => {
    sessionStorage.removeItem(STORAGE_KEY);
    clearInterval(tickRef.current);
    setSession(null);
    await auditDemo({ action: "stopped", email: userEmail });
  }, [userEmail]);

  return {
    demoSession: session,
    isDemoActive: session?.active ?? false,
    startDemo: start,
    stopDemo: stop,
  };
}
