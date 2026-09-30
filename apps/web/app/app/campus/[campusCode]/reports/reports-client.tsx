"use client";

import Link from "next/link";
import { useCampusInstitutionType } from "@/lib/campus/use-campus-institution";

export function CampusReportsClient({ campusCode }: { campusCode: string }) {
  const { institutionType, loading } = useCampusInstitutionType();
  const isK12 = institutionType === "k12";

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">
          {isK12 ? "School reports" : "Campus reports"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {isK12
            ? `Daily incident log and school safety summaries for ${campusCode}.`
            : `Monthly incident trends, top buildings, and scan-point activity for ${campusCode}.`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : isK12 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={`/app/campus/${campusCode}/reports/incidents`}
            className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-5 transition hover:border-sky-700/50"
          >
            <h3 className="text-base font-semibold text-white">Daily Incident Log</h3>
            <p className="mt-2 text-sm text-slate-400">
              Chronological school safety incidents and concerns for review and follow-up.
            </p>
          </Link>
          <Link
            href={`/app/campus/${campusCode}/reports/school-safety`}
            className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-5 transition hover:border-sky-700/50"
          >
            <h3 className="text-base font-semibold text-white">School Safety Report</h3>
            <p className="mt-2 text-sm text-slate-400">
              Counts by K-12 incident / concern type for a selected date range. Export CSV or PDF.
              Not a Clery Act report.
            </p>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
          <h3 className="text-base font-semibold text-white">Clery Act ASR</h3>
          <p className="mt-2 text-sm text-slate-400">
            Generate the Clery tally, import records from campus PD / conduct systems, and add manual
            CSA entries.
          </p>
          <a
            href={`/app/campus/${campusCode}/clery`}
            className="mt-3 inline-block text-sm text-sky-400 hover:underline"
          >
            Open Clery report →
          </a>
        </div>
      )}
    </section>
  );
}
