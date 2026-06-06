"use client";

import { useCallback, useEffect, useState } from "react";
import type { HospitalPortalContext, UserContext } from "rapid-cortex-shared";

import { CapacityUpdateForm } from "@/components/hospital-routing/capacity-update-form";
import { CurrentStatusPanel } from "@/components/hospital-routing/current-status-panel";
import { RecentUpdatesPanel } from "@/components/hospital-routing/recent-updates-panel";
import { fetchHospitalPortalContext } from "@/lib/hospital-portal/api";

export function HospitalPortalClient({ user }: { user: UserContext }) {
  const [context, setContext] = useState<HospitalPortalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchHospitalPortalContext();
      setContext(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load portal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Loading hospital portal…
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-white">
        <p>{error ?? "Unable to load portal"}</p>
        <button type="button" onClick={() => void load()} className="text-sky-400 underline">
          Retry
        </button>
      </div>
    );
  }

  const displayName = user.displayName ?? user.email;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">{context.hospital.name}</h1>
            <p className="text-sm text-slate-400">Hospital capacity portal</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-white">{displayName}</p>
            <p className="text-slate-400">{user.role}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CapacityUpdateForm context={context} onUpdated={() => void load()} />
        </div>
        <div className="space-y-6">
          <CurrentStatusPanel currentCapacity={context.capacity} />
          <RecentUpdatesPanel key={context.capacity?.timestamp ?? "empty"} />
        </div>
      </main>
    </div>
  );
}
