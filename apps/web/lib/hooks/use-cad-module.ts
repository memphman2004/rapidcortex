"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdminCadModule, fetchAgencyCadModule, isApiConfigured } from "@/lib/api";

export function useCadModuleAccess(enabled = true) {
  return useQuery({
    queryKey: ["cad-module", "self"],
    queryFn: fetchAgencyCadModule,
    enabled: enabled && isApiConfigured(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminCadModule(agencyId: string | undefined) {
  return useQuery({
    queryKey: ["cad-module", agencyId],
    queryFn: () => fetchAdminCadModule(agencyId ?? ""),
    enabled: isApiConfigured() && Boolean(agencyId),
    staleTime: 15_000,
    retry: false,
  });
}
