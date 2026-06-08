"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCadWritebackApprovals } from "@/lib/api";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

export type NavBadgeCounts = Partial<Record<string, number>>;

/** Resolve `badge: { type: "count", key }` values for role-nav sidebars. */
export function useNavBadgeCounts(role?: string): NavBadgeCounts {
  const pendingCadQ = useQuery({
    queryKey: ["nav-badge", "pendingCadApprovals"],
    queryFn: async () => {
      const r = await fetchCadWritebackApprovals({ status: "pending_approval" });
      return r.items.length;
    },
    enabled:
      Boolean(role && (role === "supervisor" || role === "agencyit") && isCadWritebackUiEnabled()),
    refetchInterval: 30_000,
  });

  return {
    pendingCadApprovals: pendingCadQ.data ?? 0,
    // openIncidents, activeCalls, pendingReviews, openGuestReports — wire when hooks exist
  };
}
