"use client";

import { isDemoAgencyId } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";

/** Persistent safety banner on allowlisted demo tenants. */
export function DemoModeBanner() {
  const { user } = useSession();
  if (!user?.agencyId || !isDemoAgencyId(user.agencyId)) return null;

  return (
    <div
      role="status"
      className="border-b border-red-500/40 bg-red-950 px-4 py-2 text-center text-xs font-semibold tracking-wide text-red-100 md:px-6"
    >
      SIMULATION MODE — NOT A REAL INCIDENT
    </div>
  );
}
