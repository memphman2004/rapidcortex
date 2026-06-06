"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect } from "react";
import { PlatformGate } from "@/components/platform/platform-gate";
import { PlatformSidebar } from "@/components/platform/platform-sidebar";
import { PlatformTopbar } from "@/components/platform/platform-topbar";
import {
  mapJurisdictionPlatformPathToRcAdmin,
  RC_PLATFORM_COMMAND_PATHS,
} from "@/lib/platform-command-nav";

const mobileRoutes = [
  [RC_PLATFORM_COMMAND_PATHS.dashboard, "Home"],
  [RC_PLATFORM_COMMAND_PATHS.agencies, "Agencies"],
  [RC_PLATFORM_COMMAND_PATHS.users, "Users"],
  [RC_PLATFORM_COMMAND_PATHS.onboarding, "Onboard"],
  [RC_PLATFORM_COMMAND_PATHS.systemHealth, "Health"],
] as const;

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();

  const rcAdminTarget = mapJurisdictionPlatformPathToRcAdmin(pathname);

  useLayoutEffect(() => {
    if (rcAdminTarget && rcAdminTarget !== pathname) router.replace(rcAdminTarget);
  }, [pathname, router, rcAdminTarget]);

  if (rcAdminTarget && rcAdminTarget !== pathname) {
    return (
      <p className="p-8 text-sm text-slate-500" role="status">
        Opening RC Admin console…
      </p>
    );
  }

  return (
    <PlatformGate>
      <div
        className="rc-workstation-root flex min-h-0 min-h-[50vh] flex-1 flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 lg:flex-row"
        style={{
          fontFamily: 'var(--rc-dashboard-font-family, "Courier New", monospace)',
        }}
      >
        <PlatformSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PlatformTopbar />
          <nav
            className="flex gap-1 overflow-x-auto border-b border-slate-800/90 px-2 py-1.5 lg:hidden"
            aria-label="Platform sections (small viewport)"
          >
            {mobileRoutes.map(([path, label]) => {
              const href = path;
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={path}
                  href={href}
                  className={`shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                    active ? "bg-slate-800 text-white" : "text-slate-400"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-5 lg:px-6 2xl:px-10">
            <div className="mx-auto w-full max-w-[var(--rc-content-max)]">{children}</div>
          </div>
        </div>
      </div>
    </PlatformGate>
  );
}
