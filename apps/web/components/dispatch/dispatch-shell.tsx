"use client";

import { usePathname } from "next/navigation";
import { ConnectionStatusStrip } from "@/components/dispatch/connection-status-strip";
import { SideNav } from "@/components/dispatch/side-nav";
import { TopBar } from "@/components/dispatch/top-bar";
import { HelpChrome } from "@/components/help/help-chrome";
import { isPsapConsoleHomePath } from "@/components/psap/psap-shell-chrome";
import type { UserContext } from "rapid-cortex-shared";

const SHELL = {
  bg: "#090d1a",
  accent: "#3b82f6",
} as const;

export function DispatchShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: UserContext | null;
}) {
  const pathname = usePathname() ?? "";
  const consoleHome = isPsapConsoleHomePath(pathname);

  // Console home owns its own chrome (sidebar/header); avoid double nav.
  if (consoleHome) {
    return <>{children}</>;
  }

  return (
    <HelpChrome role={user?.role ?? "dispatcher"}>
      <div
        className="rc-workstation-root text-slate-100"
        style={{
          fontFamily: "var(--rc-dashboard-font-family, Inter, ui-sans-serif, system-ui, sans-serif)",
          background: SHELL.bg,
          color: "#e2e8f0",
          // Accent token for dispatcher chrome (sky → product blue)
          ["--rc-psap-accent" as string]: SHELL.accent,
        }}
      >
        <TopBar user={user} />
        <div className="rc-workstation-main min-h-0">
          <SideNav />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ background: "rgba(9,13,26,0.85)" }}
            >
              {children}
            </div>
            <ConnectionStatusStrip />
          </div>
        </div>
      </div>
    </HelpChrome>
  );
}
