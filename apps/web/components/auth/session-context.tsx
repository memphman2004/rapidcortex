"use client";

import type { UserContext } from "rapid-cortex-shared/types";
import { initSessionTimeout } from "@/lib/session-timeout";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SessionState = {
  user: UserContext | null;
  isLoading: boolean;
  /** Fetches current user; returns the resolved user (null if unauthenticated). */
  refresh: () => Promise<UserContext | null>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      const data = (await res.json()) as { user: UserContext | null };
      const next = data.user ?? null;
      setUser(next);
      return next;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    return initSessionTimeout(user.role);
  }, [user]);

  /** Keep ID/access cookies fresh via `/api/auth/session` (uses refresh token when ID JWT expires). */
  useEffect(() => {
    const intervalMs = 5 * 60 * 1000;
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo(
    () => ({ user, isLoading, refresh }),
    [user, isLoading, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
