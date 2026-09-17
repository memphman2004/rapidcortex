"use client";

import { HelpChrome } from "@/components/help/help-chrome";
import { SideNav } from "@/components/dispatch/side-nav";
import { CallAssistWorkspace } from "@/components/call-assist/call-assist-workspace";
import { CallAssistProductBaseProvider } from "@/lib/jurisdiction-context";
import type { UserContext } from "rapid-cortex-shared";

export function CallAssistProductShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: UserContext | null;
}) {
  return (
    <CallAssistProductBaseProvider>
      <HelpChrome role={user?.role ?? "call_assist_operator"}>
        <div data-vertical="call-assist" className="flex min-h-screen flex-col bg-[#0f1117] text-slate-100">
          <p className="border-b border-teal-900/80 bg-teal-950/40 px-4 py-1.5 text-center text-[11px] font-semibold tracking-wide text-teal-200">
            NON-EMERGENCY CALL ASSIST — NOT A 911 DISPATCH CONSOLE
          </p>
          <div className="flex min-h-0 min-w-0 flex-1">
            <SideNav />
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <CallAssistWorkspace>{children}</CallAssistWorkspace>
            </div>
          </div>
        </div>
      </HelpChrome>
    </CallAssistProductBaseProvider>
  );
}
