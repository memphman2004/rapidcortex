"use client";

import { useEffect, useState } from "react";
import { ALERT_SMS_CARRIER_CAVEAT, type AlertDispatchJob } from "rapid-cortex-shared";

export function VerticalAlertJobClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<AlertDispatchJob | null>(null);
  const [acknowledgedSessions, setAcknowledgedSessions] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/alerts/dispatch/${encodeURIComponent(jobId)}/status`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          error?: string;
          status?: AlertDispatchJob["status"];
          channelSummary?: AlertDispatchJob["channelSummary"];
          acknowledgedSessions?: number;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        const full = await fetch(`/api/alerts/dispatch/${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const body = (await full.json()) as { job?: AlertDispatchJob; error?: string };
        if (!full.ok || !body.job) throw new Error(body.error ?? "Failed to load job");
        setJob(body.job);
        setAcknowledgedSessions(data.acknowledgedSessions ?? 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => window.clearInterval(id);
  }, [jobId]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!job) return <p className="text-sm text-slate-400">Loading delivery status…</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">{job.title}</h2>
      <p className="text-sm text-slate-300">{job.body}</p>
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {job.status} · {job.severity} · {job.templateType}
      </p>
      <p className="text-sm text-sky-200">
        Web dashboard: {acknowledgedSessions} console session{acknowledgedSessions === 1 ? "" : "s"} acknowledged
      </p>
      <p className="text-xs text-amber-200">{ALERT_SMS_CARRIER_CAVEAT}</p>
      <ul className="space-y-2">
        {job.channelSummary.map((ch) => (
          <li key={ch.channel} className="rounded border border-slate-700 p-3 text-sm text-slate-200">
            <span className="font-semibold">{ch.channel.replaceAll("_", " ")}</span>
            <span className="ml-2 text-slate-400">
              queued {ch.queued} · sent {ch.sent} · skipped {ch.skipped} · failed {ch.failed}
            </span>
            {ch.skipReason ? <p className="mt-1 text-xs text-amber-200/90">{ch.skipReason}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
