"use client";

import Link from "next/link";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isNonEmergencyTriageEnabled } from "@/lib/runtime-flags";

export default function AdminTriageConfigPage() {
  const to = useJurisdictionLink();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Non-emergency triage</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Triage snapshots are written to the existing analyses table with{" "}
          <code className="rounded bg-slate-900 px-1 text-slate-200">analysisRecordKind: &quot;triage&quot;</code>.
          Segment cadence uses <span className="font-mono text-slate-300">TRIAGE_DETECT_EVERY_N_SEGMENTS</span> (API)
          and must align with <span className="font-mono text-slate-300">NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE</span>{" "}
          for dashboard badges, queue tab, and overrides.
        </p>
      </div>
      {!isNonEmergencyTriageEnabled() ? (
        <p className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-sm text-amber-100">
          Enable <span className="font-mono">ENABLE_NON_EMERGENCY_TRIAGE</span> and{" "}
          <span className="font-mono">NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE</span>, then PATCH your agency with{" "}
          <span className="font-mono">triage: {"{"} enabled: true {"}"}</span> (and optional{" "}
          <span className="font-mono">nonEmergencyQueueEnabled</span>).
        </p>
      ) : (
        <p className="text-sm text-emerald-300/90">Triage UI flag is on for this web build.</p>
      )}
      <section className="rounded-lg border border-slate-800 bg-slate-900/35 p-4 text-sm text-slate-400">
        <p>
          Optional: set <span className="font-mono text-slate-300">TRIAGE_MOCK=true</span> in the API for deterministic
          pilot demos.
        </p>
      </section>
      <p className="text-sm text-slate-400">
        <Link href={to("/admin")} className="text-sky-400 hover:underline">
          ← Admin overview
        </Link>
      </p>
    </div>
  );
}
