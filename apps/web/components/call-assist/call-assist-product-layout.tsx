"use client";

import { useState, type CSSProperties } from "react";
import { Menu, PhoneIncoming } from "lucide-react";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared";
import type { UserRole } from "rapid-cortex-shared/types";
import { useSession } from "@/components/auth/session-context";
import { CallAssistWorkspace } from "@/components/call-assist/call-assist-workspace";
import { CampusDashboardHeaderUtilities } from "@/components/campus/campus-dashboard-header-utilities";
import { HelpChrome } from "@/components/help/help-chrome";
import { RoleNavSidebar } from "@/components/navigation/role-nav-sidebar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  ROLE_DASHBOARD_PALETTE_BY_ROLE,
  roleDashboardShellVars,
} from "@/lib/dashboards/role-dashboard-design";
import { CallAssistProductBaseProvider } from "@/lib/jurisdiction-context";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";

const DISCLAIMER = "NON-EMERGENCY CALL ASSIST — NOT A 911 DISPATCH CONSOLE";

export function CallAssistProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <CallAssistProductBaseProvider>
      <ThemeProvider storageKey="rc-theme-call-assist">
        <CallAssistProductLayoutInner>{children}</CallAssistProductLayoutInner>
      </ThemeProvider>
    </CallAssistProductBaseProvider>
  );
}

function CallAssistProductLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const [mobileNav, setMobileNav] = useState(false);
  const { theme, rootRef } = useThemeRoot<HTMLDivElement>();
  const role = (migrateLegacyRapidCortexRoleTokenValue(user?.role ?? "") ??
    user?.role ??
    "call_assist_operator") as UserRole;
  const identity =
    ROLE_DASHBOARD_PALETTE_BY_ROLE[role] ?? ROLE_DASHBOARD_PALETTE_BY_ROLE.call_assist_operator;
  const shellVars = roleDashboardShellVars(identity) as CSSProperties;

  if (isLoading) {
    return <p className="p-6 text-sm text-slate-400">Loading Call Assist…</p>;
  }
  if (!user) return null;

  return (
    <HelpChrome role={user.role}>
      <div
        ref={rootRef}
        data-theme={theme}
        data-vertical="call-assist"
        className="flex min-h-screen flex-col bg-[var(--rc-bg,#0f1117)] text-[var(--rc-text-primary,#e2e8f0)]"
        style={{ ...shellVars, colorScheme: theme }}
      >
        <div className="border-b border-teal-800/60 bg-teal-950/40 px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300">
          {DISCLAIMER}
        </div>
        {mobileNav ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNav(false)}
          />
        ) : null}
        <div className="flex min-h-0 flex-1">
          <RoleNavSidebar user={user} mobileOpen={mobileNav} onNavigate={() => setMobileNav(false)} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex min-h-12 flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-2">
              <button
                type="button"
                className="inline-flex rounded-md border border-slate-700 p-2 text-slate-200 md:hidden"
                aria-label="Open sidebar"
                onClick={() => setMobileNav(true)}
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-500/40 bg-teal-500/10">
                  <PhoneIncoming className="h-4 w-4 text-teal-400" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{identity.identityTitle}</p>
                  <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                    {identity.identitySubtitle}
                  </p>
                </div>
              </div>
              <span className="hidden rounded border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300 sm:inline">
                Call Assist
              </span>
              <div className="ml-auto">
                <CampusDashboardHeaderUtilities
                  email={user.email}
                  role={user.role}
                  agencyId={user.agencyId}
                  userId={user.userId}
                  leadingSlot={<ThemeToggle />}
                />
              </div>
            </header>
            <main className="min-h-0 flex-1 overflow-hidden">
              <CallAssistWorkspace>{children}</CallAssistWorkspace>
            </main>
          </div>
        </div>
      </div>
    </HelpChrome>
  );
}
