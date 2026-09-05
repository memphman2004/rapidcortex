"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  CAMPUS_SITE_SCOPE_ALL,
  type CampusSite,
} from "rapid-cortex-shared";
import { fetchCampusStats } from "@/lib/campus/campus-dashboard-api";

const storageKey = (agencyId: string) => `rc-campus-site:${agencyId}`;

export type CampusSiteScopeValue = {
  scope: string;
  setScope: (next: string) => void;
  sites: CampusSite[];
  primarySiteCode: string;
};

const CampusSiteScopeContext = createContext<CampusSiteScopeValue | null>(null);

function useCampusSiteScopeState(
  agencyId: string,
  supplied?: { sites?: CampusSite[]; primarySiteCode?: string },
): CampusSiteScopeValue {
  const [scope, setScopeState] = useState(CAMPUS_SITE_SCOPE_ALL);
  const [loadedSites, setLoadedSites] = useState<CampusSite[]>(supplied?.sites ?? []);
  const [loadedPrimary, setLoadedPrimary] = useState(supplied?.primarySiteCode ?? "");

  useEffect(() => {
    if (!agencyId) return;
    try {
      const stored = sessionStorage.getItem(storageKey(agencyId));
      if (stored) setScopeState(stored);
    } catch {
      /* ignore */
    }
  }, [agencyId]);

  useEffect(() => {
    if (supplied?.sites?.length) {
      setLoadedSites(supplied.sites);
      setLoadedPrimary(supplied.primarySiteCode ?? "");
      return;
    }
    if (!agencyId) return;
    let cancelled = false;
    void fetchCampusStats(agencyId)
      .then((stats) => {
        if (cancelled) return;
        setLoadedSites(stats.sites ?? []);
        setLoadedPrimary(stats.primarySiteCode ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedSites([]);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId, supplied?.primarySiteCode, supplied?.sites]);

  const setScope = useCallback(
    (next: string) => {
      setScopeState(next);
      if (!agencyId) return;
      try {
        sessionStorage.setItem(storageKey(agencyId), next);
      } catch {
        /* ignore */
      }
    },
    [agencyId],
  );

  return {
    scope,
    setScope,
    sites: loadedSites,
    primarySiteCode: loadedPrimary,
  };
}

/** Shared campus filter for every page under the campus shell (header + queues + maps). */
export function CampusSiteScopeProvider({
  agencyId,
  supplied,
  children,
}: {
  agencyId: string;
  supplied?: { sites?: CampusSite[]; primarySiteCode?: string };
  children: ReactNode;
}) {
  const value = useCampusSiteScopeState(agencyId, supplied);
  return (
    <CampusSiteScopeContext.Provider value={value}>{children}</CampusSiteScopeContext.Provider>
  );
}

export function useCampusSiteScope(
  agencyId: string,
  supplied?: { sites?: CampusSite[]; primarySiteCode?: string },
): CampusSiteScopeValue {
  const ctx = useContext(CampusSiteScopeContext);
  const local = useCampusSiteScopeState(ctx ? "" : agencyId, ctx ? undefined : supplied);
  return ctx ?? local;
}
