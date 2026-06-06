import { ConnectionStatusStrip } from "@/components/dispatch/connection-status-strip";
import { SideNav } from "@/components/dispatch/side-nav";
import { TopBar } from "@/components/dispatch/top-bar";
import type { UserContext } from "rapid-cortex-shared";

export function DispatchShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: UserContext | null;
}) {
  return (
    <div
      className="rc-workstation-root bg-slate-950/90 text-slate-100 ring-1 ring-slate-800/30 backdrop-blur-sm"
      style={{
        fontFamily: 'var(--rc-dashboard-font-family, "Courier New", monospace)',
      }}
    >
      <TopBar user={user} />
      <div className="rc-workstation-main min-h-0">
        <SideNav />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/60">{children}</div>
          <ConnectionStatusStrip />
        </div>
      </div>
    </div>
  );
}
