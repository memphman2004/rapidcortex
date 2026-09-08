"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "@/components/auth/session-context";
import {
  RC_ACTIVE_AGENCY_STORAGE_KEY,
  canMutateActiveAgency,
  jwtTenantAgencyId,
  persistableAgencyId,
  resolveActiveAgencyId,
} from "@/lib/agency/switcher-agency";

type AgencyContextValue = {
  activeAgencyId: string | null;
  setActiveAgency: (id: string) => void;
  isRcAdmin: boolean;
  hydrated: boolean;
};

const AgencyContext = createContext<AgencyContextValue | null>(null);

/**
 * Active tenant for dashboard API calls.
 *
 * RC operators (`rcsuperadmin`, `rcadmin`, `rcitadmin`): `activeAgencyId` is mutable.
 * Every other role: JWT `custom:agencyId` only — `setActiveAgency` is a no-op.
 */
export function AgencyProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const isRcAdmin = canMutateActiveAgency(user?.role);
  const jwtAgencyId = jwtTenantAgencyId(user?.agencyId);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isRcAdmin) {
      setOverrideId(null);
      setHydrated(true);
      return;
    }
    try {
      setOverrideId(persistableAgencyId(sessionStorage.getItem(RC_ACTIVE_AGENCY_STORAGE_KEY)));
    } catch {
      setOverrideId(null);
    }
    setHydrated(true);
  }, [isLoading, isRcAdmin]);

  const setActiveAgency = useCallback(
    (id: string) => {
      if (!isRcAdmin) return;
      const next = persistableAgencyId(id);
      setOverrideId(next);
      try {
        if (next) sessionStorage.setItem(RC_ACTIVE_AGENCY_STORAGE_KEY, next);
        else sessionStorage.removeItem(RC_ACTIVE_AGENCY_STORAGE_KEY);
      } catch {
        /* private mode / quota */
      }
    },
    [isRcAdmin],
  );

  const activeAgencyId = resolveActiveAgencyId({ isRcAdmin, jwtAgencyId, overrideId });

  const value = useMemo(
    () => ({
      activeAgencyId,
      setActiveAgency,
      isRcAdmin,
      hydrated: hydrated && !isLoading,
    }),
    [activeAgencyId, setActiveAgency, isRcAdmin, hydrated, isLoading],
  );

  return <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>;
}

export function useAgencyContext(): AgencyContextValue {
  const ctx = useContext(AgencyContext);
  if (!ctx) {
    throw new Error("useAgencyContext must be used within AgencyProvider");
  }
  return ctx;
}

/** Query enablement + agency id for Call Assist (and other tenant-scoped dashboards). */
export function useCallAssistAgencyScope() {
  const { activeAgencyId, isRcAdmin, hydrated } = useAgencyContext();
  const ready = hydrated && (!isRcAdmin || Boolean(activeAgencyId));
  return {
    agencyId: activeAgencyId,
    /** Only RC ops may send `?agencyId=` — customers always use the JWT tenant. */
    requestAgencyId: isRcAdmin ? activeAgencyId ?? undefined : undefined,
    ready,
    isRcAdmin,
    hydrated,
  };
}
