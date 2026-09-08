"use client";

import { Suspense } from "react";
import { AgencySwitcher } from "@/components/agency/agency-switcher";
import { CallAssistRouteGate } from "@/components/call-assist/call-assist-route-gate";
import { CallAssistConfigProvider } from "@/contexts/call-assist-config-context";
import { useCallAssistAgencyScope } from "@/contexts/agency-context";

export default function CallAssistLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading Call Assist…</p>}>
      <CallAssistWorkspace>{children}</CallAssistWorkspace>
    </Suspense>
  );
}

function CallAssistWorkspace({ children }: { children: React.ReactNode }) {
  const { isRcAdmin, agencyId, hydrated } = useCallAssistAgencyScope();
  const needsAgency = isRcAdmin && hydrated && !agencyId;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col md:flex-row">
      <AgencySwitcher />
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        {isRcAdmin && !hydrated ? (
          <p className="p-6 text-sm text-slate-400">Loading agencies…</p>
        ) : needsAgency ? (
          <SelectAgencyEmpty />
        ) : (
          <CallAssistConfigProvider>
            <CallAssistRouteGate>{children}</CallAssistRouteGate>
          </CallAssistConfigProvider>
        )}
      </div>
    </div>
  );
}

function SelectAgencyEmpty() {
  return (
    <div className="space-y-2 p-6">
      <h1 className="text-lg font-semibold text-white">Call Assist</h1>
      <p className="max-w-xl text-sm text-slate-400">
        Select an agency in the list to scope sessions, stats, and configuration. This switcher is
        only available to Rapid Cortex operators.
      </p>
    </div>
  );
}
