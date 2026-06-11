"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchIncomingSharedIncidents } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export default function SharedIncomingIncidentsPage() {
  const to = useJurisdictionLink();
  const q = useQuery({
    queryKey: ["shared-incoming"],
    queryFn: fetchIncomingSharedIncidents,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6 text-slate-100">
      <h1 className="text-lg font-semibold text-white">Agency Share</h1>
      <p className="max-w-2xl text-sm text-slate-400">
        Read-only view of incidents a partner agency shared with you via Agency Share. Open the live workspace
        to review transcript and analysis.
      </p>
      {q.isError ? <p className="text-sm text-rose-300">{(q.error as Error).message}</p> : null}
      <ul className="space-y-2">
        {(q.data ?? []).map(({ share, incident }) => (
          <li
            key={share.shareId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium text-slate-100">{incident.title}</div>
              <div className="text-xs text-slate-500">
                From {share.ownerAgencyId} · expires TTL managed in Dynamo · {share.status}
              </div>
            </div>
            <Link
              className="rounded bg-sky-900/40 px-3 py-1 text-xs font-medium text-sky-100 hover:bg-sky-800/50"
              href={`${to("/dashboard")}?incident=${encodeURIComponent(incident.incidentId)}`}
            >
              Open read-only workspace
            </Link>
          </li>
        ))}
      </ul>
      {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-slate-500">No active incoming shares.</p>
      ) : null}
    </div>
  );
}
