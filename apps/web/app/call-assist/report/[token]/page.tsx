"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";

type SelfServiceDto = {
  agencyId?: string;
  sessionId?: string;
  portalUrl?: string;
  status?: string;
  caseNumber?: string;
  error?: string;
};

async function loadToken(token: string): Promise<SelfServiceDto> {
  const res = await fetch(`/api/public/call-assist/self-service/${encodeURIComponent(token)}`, { cache: "no-store" });
  const body = (await res.json()) as SelfServiceDto;
  if (!res.ok) throw new Error(body.error ?? "This reporting link is invalid or expired.");
  return body;
}

export default function CallAssistSelfServiceReportPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? "");
  const [notes, setNotes] = useState("");
  const query = useQuery({
    queryKey: ["ca-self-service", token],
    queryFn: () => loadToken(token),
    enabled: token.length >= 8,
  });
  const complete = useMutation({
    mutationFn: async (disposition: "completed" | "abandoned") => {
      const res = await fetch(`/api/public/call-assist/self-service/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, notes }),
      });
      const body = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to update this report.");
      return body;
    },
  });

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6 text-slate-100">
      <h1 className="text-lg font-semibold">Online report</h1>
      <p className="text-sm text-slate-400">
        This is not for emergencies. If someone is hurt or in danger, hang up and dial 911.
      </p>
      {query.isLoading ? <p className="text-sm text-slate-500">Loading your report link…</p> : null}
      {query.error ? (
        <p className="text-sm text-rose-300">{query.error instanceof Error ? query.error.message : "Invalid link"}</p>
      ) : null}
      {query.data ? (
        <>
          <p className="text-sm text-slate-300">
            Status: {query.data.status ?? "SENT"}
            {query.data.caseNumber ? ` · Reference ${query.data.caseNumber}` : ""}
          </p>
          {query.data.portalUrl ? (
            <a
              className="inline-flex rounded bg-sky-700 px-3 py-2 text-sm text-white"
              href={query.data.portalUrl}
              target="_blank"
              rel="noreferrer"
            >
              Continue on the agency reporting site
            </a>
          ) : null}
          <label className="block text-[12px] text-slate-400">
            Notes (optional)
            <textarea
              className="mt-1 h-20 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white"
              disabled={complete.isPending}
              onClick={() => complete.mutate("completed")}
            >
              I finished this report
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
              disabled={complete.isPending}
              onClick={() => complete.mutate("abandoned")}
            >
              I cannot complete this
            </button>
          </div>
          {complete.data?.status ? (
            <p className="text-sm text-emerald-300">Saved. Status is now {complete.data.status}.</p>
          ) : null}
          {complete.error ? (
            <p className="text-sm text-rose-300">{complete.error instanceof Error ? complete.error.message : "Update failed"}</p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
