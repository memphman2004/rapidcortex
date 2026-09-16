"use client";

import { useState } from "react";

type Props = {
  token: string;
  initialStatus?: string;
};

export function SelfServiceCompleteForm({ token, initialStatus }: Props) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const alreadyDone = status === "COMPLETED" || status === "FAILED";

  async function submit(disposition: "completed" | "abandoned") {
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/call-assist/self-service/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disposition, notes }),
      });
      const body = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(body.error ?? "Unable to update this report.");
      setStatus(body.status ?? disposition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {alreadyDone ? (
        <p className="text-sm text-emerald-300">
          {status === "COMPLETED" ? "Saved. You marked this report complete." : "Saved. You marked this report as not completed."}
        </p>
      ) : (
        <>
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
              className="rounded bg-emerald-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={isPending}
              onClick={() => void submit("completed")}
            >
              I finished this report
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 disabled:opacity-50"
              disabled={isPending}
              onClick={() => void submit("abandoned")}
            >
              I cannot complete this
            </button>
          </div>
        </>
      )}
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
