"use client";

import { useState, type CSSProperties } from "react";
import type { UserContext } from "rapid-cortex-shared/types";
import { RoleNavSidebar } from "@/components/navigation/role-nav-sidebar";
import { HelpChrome } from "@/components/help/help-chrome";
import { ActiveNoticesBanner } from "@/components/notices/ActiveNoticesBanner";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
import { TopNav } from "@/components/dashboards/top-nav";
import {
  getRoleDashboardIdentity,
  roleDashboardShellVars,
} from "@/lib/dashboards/role-dashboard-design";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";

export function SalesWorkspaceShell({
  user,
  children,
}: {
  user: UserContext;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider storageKey="rc-theme-sales">
      <SalesWorkspaceShellInner user={user}>{children}</SalesWorkspaceShellInner>
    </ThemeProvider>
  );
}

function SalesWorkspaceShellInner({
  user,
  children,
}: {
  user: UserContext;
  children: React.ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const { theme, rootRef } = useThemeRoot<HTMLDivElement>();
  // Prefer role palette (salescontractor / rcsuperadmin); rc-admin prefix is fallback only.
  const identity = getRoleDashboardIdentity("rc-admin", user.role);
  const shellVars = roleDashboardShellVars(identity) as CSSProperties;

  return (
    <HelpChrome role={user.role}>
      <div
        ref={rootRef}
        data-theme={theme}
        className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-text-primary)]"
        style={
          {
            ...shellVars,
            colorScheme: theme,
            fontFamily:
              "var(--rc-dashboard-font-family, Inter, ui-sans-serif, system-ui, sans-serif)",
            ["--role-accent" as string]: identity.accent,
          } as CSSProperties
        }
      >
        {mobileNav ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileNav(false)}
          />
        ) : null}
        <div className="flex min-h-screen">
          <RoleNavSidebar
            user={user}
            mobileOpen={mobileNav}
            onNavigate={() => setMobileNav(false)}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav
              identity={identity}
              user={user}
              onMenuClick={() => setMobileNav(true)}
            />
            <DemoModeBanner />
            <ActiveNoticesBanner />
            <main className="flex-1 bg-[var(--rc-bg)] p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    </HelpChrome>
  );
}
