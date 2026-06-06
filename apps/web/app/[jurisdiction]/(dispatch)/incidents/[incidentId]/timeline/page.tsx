"use client";

import Link from "next/link";
import { use } from "react";
import { IncidentTimeline } from "@/components/dispatch/timeline/incident-timeline";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export default function IncidentTimelinePage({
  params,
}: {
  params: Promise<{ jurisdiction: string; incidentId: string }>;
}) {
  const { incidentId } = use(params);
  const toPath = useJurisdictionLink();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 pb-10 md:p-6 print:p-8">
      <header className="print:hidden">
        <Link href={toPath("/incidents")} className="text-xs text-sky-400 hover:text-sky-300">
          ← Incidents
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-white">Incident timeline</h1>
        <p className="mt-1 font-mono text-sm text-slate-400">{incidentId}</p>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Chronological audit trail for post-incident review and compliance export.
        </p>
      </header>
      <header className="hidden print:block">
        <h1 className="text-lg font-semibold text-black">Incident timeline — {incidentId}</h1>
        <p className="text-sm text-gray-700">Exported {new Date().toLocaleString()}</p>
      </header>
      <IncidentTimeline incidentId={incidentId} />
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .incident-timeline pre {
            color: #333 !important;
            border: 1px solid #ccc;
          }
        }
      `}</style>
    </div>
  );
}
