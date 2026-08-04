"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { HiringBookingsConfig } from "rapid-cortex-shared";

const QK = ["rc-hiring-bookings"] as const;
const API = "/api/rc-admin/settings/hiring-bookings";

async function fetchConfig(): Promise<HiringBookingsConfig> {
  const r = await fetch(API, { credentials: "include" });
  return r.ok ? r.json() : {};
}
async function saveConfig(cfg: HiringBookingsConfig): Promise<void> {
  const r = await fetch(API, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to save");
}

const inp =
  "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500";

export function HiringBookingsSettings() {
  const qc = useQueryClient();
  const cfgQ = useQuery({ queryKey: QK, queryFn: fetchConfig });
  const [form, setForm] = useState<HiringBookingsConfig>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (cfgQ.data) setForm(cfgQ.data);
  }, [cfgQ.data]);

  const saveM = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <div className="max-w-xl rounded-lg border border-slate-800 bg-[#0a1428] p-6">
      <h3 className="mb-1 text-sm font-semibold text-slate-100">Microsoft Bookings</h3>
      <p className="mb-5 text-xs text-slate-500">
        Paste your Bookings service URLs below. These auto-populate the scheduling link when moving an
        applicant to Phone Screen or Interview, and are embedded in the automated email as a “Schedule
        your call” button.
      </p>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-300">Phone Screen booking URL</label>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[9px] font-semibold text-slate-400">
              📞 NO Teams meeting
            </span>
          </div>
          <p className="mb-1.5 text-[10px] text-slate-600">
            15–20 min · Phone call only · We call the candidate · Disable “Add Teams meeting” in Bookings
            for this service
          </p>
          <input
            className={inp}
            value={form.phoneScreenUrl ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, phoneScreenUrl: e.target.value }))}
            placeholder="https://outlook.office.com/book/Phoneinterview@rapidcortex.us/…"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-300">Interview booking URL</label>
            <span className="rounded-full border border-sky-700 bg-sky-900/40 px-2 py-0.5 text-[9px] font-semibold text-sky-400">
              🎥 Teams meeting included
            </span>
          </div>
          <p className="mb-1.5 text-[10px] text-slate-600">
            30–45 min · Microsoft Teams video call · Enable “Add Teams meeting” in Bookings for this
            service
          </p>
          <input
            className={inp}
            value={form.interviewUrl ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, interviewUrl: e.target.value }))}
            placeholder="https://outlook.office.com/book/VideoInterview@rapidcortex.us/…"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">
            Reviewer name
            <span className="ml-1.5 font-normal text-[10px] text-slate-600">(shown in email signature)</span>
          </label>
          <input
            className={inp}
            value={form.reviewerName ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, reviewerName: e.target.value }))}
            placeholder="Jeffrey Coleman"
          />
        </div>
      </div>

      {form.phoneScreenUrl ? (
        <div className="mt-4 rounded-md border border-slate-800 bg-slate-950 px-3 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Email preview — Phone Screen invite
          </p>
          <div className="inline-block rounded bg-sky-700 px-4 py-2 text-xs font-semibold text-white">
            Schedule Your Call →
          </div>
          <p className="mt-1.5 break-all text-[10px] text-slate-600">{form.phoneScreenUrl}</p>
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => saveM.mutate(form)}
          disabled={saveM.isPending}
          className="rounded bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saveM.isPending ? "Saving…" : "Save settings"}
        </button>
        {saved ? <span className="text-xs text-emerald-400">✓ Saved</span> : null}
        {saveM.isError ? (
          <span className="text-xs text-red-400">{(saveM.error as Error).message}</span>
        ) : null}
      </div>

      <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
        To get your Bookings URL: open Microsoft Bookings → select the service → click{" "}
        <strong className="text-slate-500">Share</strong> → copy the booking link. Create a separate
        service for Phone Screen and Interview so attendees see the correct meeting duration and
        description.
      </p>
    </div>
  );
}
