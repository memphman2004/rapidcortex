"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-context";
import { fetchAgencies, isApiConfigured } from "@/lib/api";
import { canMutateActiveAgency, toSwitcherAgency, type SwitcherAgency } from "@/lib/agency/switcher-agency";

/**
 * Portfolio of agencies for RC platform admins. Disabled for every other role.
 */
export function useRCAdminAgencies(): { agencies: SwitcherAgency[]; isLoading: boolean } {
  const { user } = useSession();
  const enabled = canMutateActiveAgency(user?.role) && isApiConfigured();
  const query = useQuery({
    queryKey: ["agencies"],
    queryFn: fetchAgencies,
    enabled,
    staleTime: 30_000,
  });
  const agencies = useMemo(
    () => (query.data ?? []).map(toSwitcherAgency),
    [query.data],
  );
  return { agencies, isLoading: query.isLoading };
}
