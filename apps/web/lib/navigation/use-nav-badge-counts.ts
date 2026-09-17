"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCadWritebackApprovals } from "@/lib/api";
import { isCadWritebackUiEnabled, isSopIntelligenceEnabled } from "@/lib/runtime-flags";
import { fetchSopIntelligenceSnapshot } from "@/lib/sop-intelligence/api";

export type NavBadgeCounts = Partial<Record<string, number>>;

/** Resolve `badge: { type: "count", key }` values for role-nav sidebars. */
export function useNavBadgeCounts(role?: string): NavBadgeCounts {
  const canSeeCad =
    Boolean(
      role &&
        (role === "supervisor" ||
          role === "agencyadmin" ||
          role === "agencyit" ||
          role === "rcsuperadmin") &&
        isCadWritebackUiEnabled(),
    );
  const canSeeSop = Boolean(
    role &&
      (role === "supervisor" || role === "agencyadmin" || role === "rcsuperadmin" || role === "rcadmin") &&
      isSopIntelligenceEnabled(),
  );

  const pendingCadQ = useQuery({
    queryKey: ["nav-badge", "pendingCadApprovals"],
    queryFn: async () => {
      const r = await fetchCadWritebackApprovals({ status: "pending_approval" });
      return r.items.length;
    },
    enabled: canSeeCad,
    refetchInterval: 30_000,
  });

  const pendingSopQ = useQuery({
    queryKey: ["nav-badge", "pendingSopUpdates"],
    queryFn: async () => {
      const snap = await fetchSopIntelligenceSnapshot();
      return snap.pending.filter((p) => p.status === "pending").length;
    },
    enabled: canSeeSop,
    refetchInterval: 15_000,
  });

  return {
    pendingCadApprovals: pendingCadQ.data ?? 0,
    pendingSopUpdates: pendingSopQ.data ?? 0,
  };
}
