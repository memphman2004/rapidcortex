"use client";

import Link from "next/link";
import { TraumaFlagsTable } from "@/components/admin/trauma-flags-table";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isDispatcherWellnessUiEnabled } from "@/lib/runtime-flags";

export default function AdminWellnessPage() {
  const to = useJurisdictionLink();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Dispatcher wellness</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Trauma-load flags are supervisor-only. Dispatchers never receive these rows in the web UI — only supervisors
          and admins should enable the client flag or open this page. Keywords are configured per agency under{" "}
          <span className="font-mono text-slate-300">wellness</span> on the agency record.
        </p>
      </div>
      {!isDispatcherWellnessUiEnabled() ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Enable <span className="font-mono">ENABLE_DISPATCHER_WELLNESS</span> and{" "}
          <span className="font-mono">NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS</span> for this surface.
        </p>
      ) : null}
      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open / recent flags</h2>
        <div className="mt-3">
          <TraumaFlagsTable />
        </div>
      </section>
      <p className="text-sm text-slate-400">
        <Link href={to("/admin")} className="text-sky-400 hover:underline">
          ← Admin overview
        </Link>
      </p>
    </div>
  );
}
