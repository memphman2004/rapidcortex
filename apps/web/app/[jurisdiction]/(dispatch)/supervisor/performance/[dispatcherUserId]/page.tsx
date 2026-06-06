"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { fetchDispatcherPerformanceDetail, postDispatcherCoachingNote } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../../_components/supervisor-access";

export default function DispatcherPerformanceDetailPage() {
  const { user } = useSession();
  const params = useParams();
  const raw = params.dispatcherUserId;
  const dispatcherUserId = typeof raw === "string" ? decodeURIComponent(raw) : "";
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const detailQuery = useQuery({
    queryKey: ["dispatcher-detail", dispatcherUserId],
    queryFn: () => fetchDispatcherPerformanceDetail(dispatcherUserId, {}),
  });

  const noteMut = useMutation({
    mutationFn: () =>
      postDispatcherCoachingNote({
        dispatcherUserId,
        body: note.trim(),
      }),
    onSuccess: async () => {
      setNote("");
      await qc.invalidateQueries({ queryKey: ["dispatcher-detail", dispatcherUserId] });
    },
  });

  const maxAct = Math.max(
    1,
    ...((detailQuery.data?.activity ?? []).map((a) => a.transcriptAppends) ?? []),
  );

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6 text-slate-100">
      <Link href={to("/supervisor/performance")} className="text-xs font-medium text-sky-400 hover:text-sky-300">
        ← Back to overview
      </Link>
      <h1 className="font-mono text-lg text-white">{dispatcherUserId}</h1>
      {detailQuery.isError ? (
        <p className="text-sm text-rose-300">{(detailQuery.error as Error).message}</p>
      ) : null}
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-medium text-slate-200">Daily activity</h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {(detailQuery.data?.activity ?? []).map((b) => {
            const h = Math.round((b.transcriptAppends / maxAct) * 100);
            return (
              <div key={b.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[14px] rounded-t bg-emerald-600/80"
                    style={{ height: `${Math.max(4, h)}%` }}
                    title={`${b.day}: ${b.transcriptAppends}`}
                  />
                </div>
                <span className="rotate-45 text-[8px] text-slate-500">{b.day.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-medium text-slate-200">Supervisor coaching notes</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-2 w-full max-w-xl rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100"
          placeholder="Private coaching note (supervisors only)…"
        />
        <button
          type="button"
          disabled={!note.trim() || noteMut.isPending}
          onClick={() => noteMut.mutate()}
          className="mt-2 rounded bg-amber-900/50 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-800/50 disabled:opacity-40"
        >
          Save note
        </button>
        {noteMut.isError ? <p className="mt-2 text-xs text-rose-300">{(noteMut.error as Error).message}</p> : null}
        <ul className="mt-4 space-y-2 border-t border-slate-800 pt-3">
          {(detailQuery.data?.coachingNotes ?? []).map((n) => (
            <li key={n.noteId} className="rounded border border-slate-800/80 bg-slate-950/50 p-2 text-xs text-slate-200">
              <div className="text-[10px] text-slate-500">
                {n.createdAt} · supervisor {n.supervisorUserId}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
