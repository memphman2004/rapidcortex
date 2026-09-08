"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { canSetupCallAssist } from "@/lib/call-assist/access";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

export function CallAssistRouteGate({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const { config, isLoading, ready } = useCallAssistConfig();
  const router = useRouter();
  const to = useJurisdictionLink();
  const pathname = usePathname();
  const search = useSearchParams();
  const enabled = Boolean(user && isCallAssistEnabled() && ready);
  const isSetup = pathname?.includes("/call-assist/setup");
  const reconfigure = search.get("reconfigure") === "1";
  const complete = config?.onboardingComplete !== false;
  const canSetup = canSetupCallAssist(user?.role);

  if (enabled && isLoading) {
    return <p className="p-6 text-sm text-slate-400">Loading Call Assist…</p>;
  }

  if (enabled && config && canSetup && !complete && !isSetup) {
    router.replace(to("/call-assist/setup"));
    return <p className="p-6 text-sm text-slate-400">Opening Call Assist setup…</p>;
  }
  if (enabled && config && isSetup && complete && !reconfigure) {
    router.replace(to("/call-assist"));
    return <p className="p-6 text-sm text-slate-400">Call Assist is already configured.</p>;
  }

  if (enabled && config && !complete && !canSetup && !isSetup) {
    return (
      <div className="space-y-3 p-6">
        <h1 className="text-lg font-semibold text-white">Call Assist</h1>
        <p className="max-w-xl text-sm text-slate-400">
          Call Assist is not activated for this agency yet. An administrator needs to finish setup.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
