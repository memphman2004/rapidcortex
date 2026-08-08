"use client";

import { useSession } from "@/components/auth/session-context";
import { ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

export function PlatformGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-500">
        Verifying platform access…
      </div>
    );
  }

  if (!user || !isRcInternalOperator(user.role)) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-900/50 bg-rose-950/40">
          <ShieldX className="h-6 w-6 text-rose-300" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-white">RC internal area restricted</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          This command center is for Rapid Cortex internal operators (RC Super Admin, RC Admin, or RC
          IT Admin). Agency administrators use the standard Admin section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
