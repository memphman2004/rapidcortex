"use client";

import { usePathname } from "next/navigation";
import { ConnectionStatusStrip } from "@/components/dispatch/connection-status-strip";
import { DispatcherModuleRailProvider } from "@/components/dispatch/dispatcher-module-rail-context";
import { SideNav } from "@/components/dispatch/side-nav";
import { TopBar } from "@/components/dispatch/top-bar";
import { HelpChrome } from "@/components/help/help-chrome";
import { isPsapConsoleHomePath } from "@/components/psap/psap-shell-chrome";
import { ThemeProvider, useThemeRoot } from "@/lib/theme/theme-context";
import type { UserContext } from "rapid-cortex-shared";

const SHELL = {
  bg: "var(--rc-bg)",
  accent: "var(--rc-blue)",
} as const;

function isDispatcherCadPath(pathname: string): boolean {
  const segs = pathname.split("/").filter(Boolean);
  const i = segs.indexOf("dispatcher");
  if (i < 0) return false;
  return segs[i + 1] !== "dashboard";
}

export function DispatchShell(props: {
  children: React.ReactNode;
  user?: UserContext | null;
}) {
  return (
    <ThemeProvider storageKey="rc-theme-dispatcher">
      <DispatchShellInner {...props} />
    </ThemeProvider>
  );
}

function DispatchShellInner({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: UserContext | null;
}) {
  const pathname = usePathname() ?? "";
  const consoleHome = isPsapConsoleHomePath(pathname);
  const workstation = isDispatcherCadPath(pathname);
  const { rootRef, theme } = useThemeRoot<HTMLDivElement>();

  // Console home owns its own chrome (sidebar/header); avoid double nav.
  if (consoleHome) {
    return <>{children}</>;
  }

  return (
    <DispatcherModuleRailProvider>
      <HelpChrome role={user?.role ?? "dispatcher"}>
      <div
        ref={rootRef}
        data-theme={theme}
        className={`rc-workstation-root ${workstation ? "dispatcher-shell" : ""}`}
        style={{
          fontFamily: "var(--rc-dashboard-font-family, Inter, ui-sans-serif, system-ui, sans-serif)",
          background: workstation ? "var(--rc-workstation-bg)" : SHELL.bg,
          color: workstation ? "var(--rc-text)" : "var(--rc-text-primary)",
          colorScheme: theme,
          ["--rc-psap-accent" as string]: workstation ? "var(--rc-blue)" : SHELL.accent,
        }}
      >
        <TopBar user={user} compact={workstation} />
        <div className="rc-workstation-main min-h-0">
          <SideNav compactRail={workstation} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ background: workstation ? "var(--rc-workstation-bg)" : "var(--rc-bg)" }}
            >
              {children}
            </div>
            <ConnectionStatusStrip />
          </div>
        </div>
      </div>
      </HelpChrome>
    </DispatcherModuleRailProvider>
  );
}
