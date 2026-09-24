"use client";

import AgencyNetworkClient from "@/components/cad-mesh/agency-network-client";
import { useSession } from "@/components/auth/session-context";
import { isCadMeshUiEnabled } from "@/lib/runtime-flags";

export default function AdminCadMeshPage() {
  const { user, isLoading } = useSession();

  if (!isCadMeshUiEnabled()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Agency Network</h1>
        <p className="mt-3 text-sm text-slate-400">The agency network isn’t enabled for this environment.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-400">Loading agency network…</div>
    );
  }

  if (!user?.agencyId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-slate-200">
        <h1 className="text-xl font-semibold text-white">Agency Network</h1>
        <p className="mt-3 text-sm text-slate-400">Sign in with an agency account to manage partner sharing.</p>
      </div>
    );
  }

  return (
    <AgencyNetworkClient
      agencyId={user.agencyId}
      agencyName={user.agencyId}
    />
  );
}
