"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardList,
  CreditCard,
  Gauge,
  Headphones,
  HeartPulse,
  LayoutDashboard,
  Plug,
  ScrollText,
  Users,
} from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { SidebarHomeButton } from "@/components/ui/sidebar-home-button";
import { SidebarSignOutFooter } from "@/components/ui/sidebar-sign-out-footer";
import { RC_PLATFORM_COMMAND_PATHS } from "@/lib/platform-command-nav";

const items: { path: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { path: RC_PLATFORM_COMMAND_PATHS.dashboard, label: "Dashboard", icon: LayoutDashboard },
  { path: RC_PLATFORM_COMMAND_PATHS.agencies, label: "Agencies", icon: Building2 },
  { path: RC_PLATFORM_COMMAND_PATHS.users, label: "Users", icon: Users },
  { path: RC_PLATFORM_COMMAND_PATHS.onboarding, label: "Onboarding", icon: ClipboardList },
  { path: RC_PLATFORM_COMMAND_PATHS.integrations, label: "Integrations", icon: Plug },
  { path: RC_PLATFORM_COMMAND_PATHS.audit, label: "Audit", icon: ScrollText },
  { path: RC_PLATFORM_COMMAND_PATHS.support, label: "Support", icon: Headphones },
  { path: RC_PLATFORM_COMMAND_PATHS.billing, label: "Billing", icon: CreditCard },
  { path: RC_PLATFORM_COMMAND_PATHS.systemHealth, label: "System health", icon: HeartPulse },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-800/90 bg-slate-950/95 lg:flex 2xl:w-72"
      aria-label="Platform navigation"
    >
      <div className="border-b border-slate-800/80 px-3 py-3 lg:px-4 lg:py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-400/90">
          Rapid Cortex
        </p>
        <p className="mt-0.5 text-sm font-semibold text-white">Platform command</p>
        <p className="mt-1 text-[11px] text-slate-500">Internal operations only</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {user ? <SidebarHomeButton user={user} className="mx-0.5" /> : null}
        {items.map(({ path, label, icon: Icon }) => {
          const href = path;
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={path}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-gradient-to-r from-rose-950/60 to-slate-900/80 text-white ring-1 ring-rose-500/30"
                  : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      {user ? <SidebarSignOutFooter email={user.email} /> : null}
      <div className="border-t border-slate-800/80 p-3 text-[10px] leading-relaxed text-slate-600">
        <Activity className="mb-1 inline h-3 w-3 text-slate-500" aria-hidden />
        <span className="block">Cross-tenant visibility. All actions audited.</span>
      </div>
    </aside>
  );
}
