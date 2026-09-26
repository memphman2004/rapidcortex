"use client";

import { useState, type CSSProperties } from "react";
import type { UserContext } from "rapid-cortex-shared/types";
import { RoleNavSidebar } from "@/components/navigation/role-nav-sidebar";
import { HelpChrome } from "@/components/help/help-chrome";
import { ActiveNoticesBanner } from "@/components/notices/ActiveNoticesBanner";
import { DemoModeBanner } from "@/components/demo/DemoModeBanner";
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

  return (
    <HelpChrome role={user.role}>
      <div
        ref={rootRef}
        data-theme={theme}
        className="min-h-screen bg-[#030712] text-slate-100"
        style={
          {
            colorScheme: theme,
            ["--role-accent" as string]: "#0284C7",
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
            <header className="flex items-center justify-between gap-3 border-b border-white/5 bg-[#0a1628]/80 px-4 py-3 backdrop-blur md:px-6">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 md:hidden"
                  onClick={() => setMobileNav(true)}
                >
                  Menu
                </button>
                <a href="/sales" className="text-sm font-semibold tracking-tight text-white">
                  NexCort iQ <span className="font-normal text-sky-400">Sales</span>
                </a>
              </div>
              <a
                href="/logout"
                className="text-xs text-slate-500 transition hover:text-slate-300"
              >
                Sign out
              </a>
            </header>
            <DemoModeBanner />
            <ActiveNoticesBanner />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </div>
    </HelpChrome>
  );
}
