"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import type { UserContext } from "rapid-cortex-shared";
import { useHomeRoute } from "@/lib/hooks/use-home-route";

export function SidebarHomeButton({
  user,
  onNavigate,
  className = "",
}: {
  user: Pick<UserContext, "role" | "agencyId">;
  onNavigate?: () => void;
  className?: string;
}) {
  const homeRoute = useHomeRoute(user);

  return (
    <Link
      href={homeRoute}
      onClick={onNavigate}
      className={`mb-2 flex items-center gap-2.5 rounded-lg border border-slate-700/40 bg-slate-800/40 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700/60 hover:text-white ${className}`}
    >
      <Home className="h-4 w-4 shrink-0" aria-hidden />
      Home
    </Link>
  );
}
