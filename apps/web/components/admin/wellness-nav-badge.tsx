"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { fetchWellnessTraumaFlags, isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isDispatcherWellnessUiEnabled } from "@/lib/runtime-flags";
import { isSupervisorOrAdmin } from "@/lib/auth/roles";

export function WellnessNavBadge() {
  const to = useJurisdictionLink();
  const { user, isLoading } = useSession();

  const enabled =
    Boolean(
      isDispatcherWellnessUiEnabled() &&
        isApiConfigured() &&
        !isLoading &&
        user &&
        isSupervisorOrAdmin(user.role),
    );

  const q = useQuery({
    queryKey: ["wellness-trauma-flags"],
    queryFn: fetchWellnessTraumaFlags,
    enabled,
    refetchInterval: 120_000,
  });

  if (!enabled) return null;

  const open = (q.data ?? []).filter((f) => f.status === "open").length;

  return (
    <Link
      href={to("/admin/wellness")}
      className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 ring-1 ring-slate-800 hover:bg-slate-900 hover:text-slate-200"
      title="Supervisor wellness queue"
    >
      Wellness
      {open > 0 ? (
        <span className="rounded-full bg-rose-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-rose-100">
          {open}
        </span>
      ) : null}
    </Link>
  );
}
