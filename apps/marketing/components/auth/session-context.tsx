"use client";

import type { UserContext } from "rapid-cortex-shared/types";
import { createContext, useCallback, useContext, useMemo } from "react";

type SessionState = {
  user: UserContext | null;
  isLoading: boolean;
  refresh: () => Promise<UserContext | null>;
};

const SessionContext = createContext<SessionState | null>(null);

/** Static marketing site — no cookie session; always link to app.rapidcortex.us. */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const refresh = useCallback(async () => null, []);

  const value = useMemo(
    () => ({
      user: null,
      isLoading: false,
      refresh,
    }),
    [refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
