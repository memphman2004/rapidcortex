"use client";

import type { ElementType, ReactNode } from "react";

/**
 * apps/web/app/hospital-admin/_components/HospitalAdminLayout.tsx
 *
 * Shared layout shell for HOSPITAL_ADMIN and HOSPITAL_COORDINATOR.
 * Renders the correct nav items per role (coordinator gets no Users/Settings).
 * Used by every hospital-admin page as a wrapper.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, BarChart3, Bed, LayoutDashboard, Map, Route, Settings, Users,
} from "lucide-react";
import {
  isHospitalAdminRole,
  isHospitalCoordinatorRole,
  hospitalRoleBadge,
} from "@/lib/hospital/hospital-access";

type NavItem = {
  href: string;
  label: string;
  icon: ElementType;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/hospital-admin/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { href: "/hospital-admin/capacity",     label: "Capacity",        icon: Bed },
  { href: "/hospital-admin/regional-map", label: "Regional Map",    icon: Map },
  { href: "/hospital-admin/analytics",    label: "Analytics",       icon: BarChart3 },
  { href: "/hospital-admin/routing",      label: "Routing Config",  icon: Route },
  { href: "/hospital-admin/users",        label: "Users",           icon: Users,    adminOnly: true },
  { href: "/hospital-admin/settings",     label: "Settings",        icon: Settings, adminOnly: true },
];

type Props = {
  children: ReactNode;
  role: string;
  facilityName?: string;
};

export function HospitalAdminLayout({ children, role, facilityName }: Props) {
  const pathname = usePathname();
  const isAdmin = isHospitalAdminRole(role);
  const isCoordinator = isHospitalCoordinatorRole(role);
  const badge = hospitalRoleBadge(role);

  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        {/* Brand / facility header */}
        <div className="border-b border-slate-800 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-900/60">
              <Activity className="h-4 w-4 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {facilityName ?? "Hospital Portal"}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-teal-500">
                {badge}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          {visibleNav.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const isViewOnly = !isAdmin && (
              item.href === "/hospital-admin/routing" ||
              item.href === "/hospital-admin/analytics"
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-teal-900/40 text-teal-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <item.icon className={`h-4 w-4 ${active ? "text-teal-400" : "text-slate-500 group-hover:text-slate-400"}`} />
                  {item.label}
                </span>
                {isViewOnly && (
                  <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
                    View
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-3">
          <Link
            href="/auth/signout"
            className="block rounded-md px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            Sign out
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
