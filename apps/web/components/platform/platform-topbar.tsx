"use client";

import { usePathname } from "next/navigation";
import { Flag } from "lucide-react";
import { FontPicker } from "@/components/ui/font-picker";
import { SessionUserIdentityBar } from "@/components/ui/session-user-identity-bar";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

const titles: Record<string, string> = {
  "/admin/platform/dashboard": "Command center",
  "/admin/platform/agencies": "Agency directory",
  "/admin/platform/users": "Users (all tenants)",
  "/admin/platform/onboarding": "Onboarding pipeline",
  "/admin/platform/integrations": "Integrations & providers",
  "/admin/platform/audit": "Global audit log",
  "/admin/platform/support": "Support & issues",
  "/admin/platform/billing": "Billing overview",
  "/admin/platform/system-health": "System health",
};

export function PlatformTopbar() {
  const pathname = usePathname() ?? "";
  const to = useJurisdictionLink();
  let title = "Platform";
  for (const [route, label] of Object.entries(titles)) {
    const full = to(route);
    if (pathname === full || pathname.startsWith(`${full}/`)) {
      title = label;
      break;
    }
  }

  return (
    <header className="rc-sticky-toolbar flex h-12 shrink-0 items-center justify-between border-b-0 bg-slate-950/90 px-3 backdrop-blur sm:px-4 lg:px-6 2xl:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden h-6 w-1 rounded-full bg-gradient-to-b from-rose-500 to-blue-600 sm:block" />
        <h1 className="truncate text-sm font-semibold text-white md:text-base">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <FontPicker />
        <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1 text-[10px] text-slate-500">
          <Flag className="h-3.5 w-3.5 text-rose-500/80" aria-hidden />
          <span className="hidden sm:inline">U.S. public safety</span>
        </div>
        <SessionUserIdentityBar />
      </div>
    </header>
  );
}
