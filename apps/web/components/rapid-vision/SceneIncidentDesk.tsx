"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signalIqVisionNavAlert } from "@/lib/rapid-vision/iq-vision-nav-alert-store";

type ActivityEntry = {
  at: string;
  actor: string;
  text: string;
  verified: boolean;
};

type SceneIncident = {
  id: string;
  cameraName: string;
  zoneLabel: string;
  detectionCategory: string;
  priority: "critical" | "high" | "normal";
  status: string;
  label: string;
  synthetic: boolean;
  modelVersion: string;
  detectedAt: string;
  activityLog: ActivityEntry[];
  logFinalized: boolean;
  linkedCadIncidentId?: string;
  cadCreatedBySystem: false;
};

const EXAMPLES = [
  {
    title: "Possible firearm",
    body: "Recognize a firearm-like shape. A visible weapon is not a verified threat, and an officer's own firearm is not a suspected crime.",
  },
  {
    title: "Possible knife",
    body: "Recognize blade-like objects while distinguishing them from phones, tools, and similar shapes.",
  },
  {
    title: "Physical altercation",
    body: "Evaluate movement over time to distinguish possible violence from sports, play, or ordinary contact.",
  },
  {
    title: "Possible person down",
    body: "Identify postures and movements that may warrant a welfare check, without assuming a medical emergency.",
  },
] as const;

const TEST_CATEGORIES = [
  ["firearm_like", "Potential firearm-like object"],
  ["blade_like", "Potential blade-like object"],
  ["altercation", "Apparent physical altercation"],
  ["person_down", "Possible person down or fall"],
  ["forced_entry", "Possible forced-entry activity"],
  ["restricted_zone", "Restricted-zone entry"],
  ["vehicle_collision", "Possible vehicle collision"],
  ["obstructed_exit", "Obstructed emergency exit"],
] as const;

async function readIncidents(): Promise<SceneIncident[]> {
  const res = await fetch("/api/vision/scene-incidents", { credentials: "include" });
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: { incidents?: SceneIncident[] } };
  return body.data?.incidents ?? [];
}

export function SceneIncidentDesk() {
  const queryClient = useQueryClient();
  const incidents = useQuery({ queryKey: ["scene-incidents"], queryFn: readIncidents });
  const [category, setCategory] = useState<string>("firearm_like");
  const [frames, setFrames] = useState(3);
  const [negative, setNegative] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("Possible false positive");
  const [note, setNote] = useState("Observation confirmed for operational review. Response decision pending.");
  const [cadId, setCadId] = useState("");
  const [cadConfirmed, setCadConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = incidents.data ?? [];
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  async function runTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/vision/scene-incidents", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cameraId: "camera-014",
          cameraName: "Camera 014",
          zoneLabel: "North Parking Garage",
          category,
          frameCount: frames,
          negativeExample: negative,
          synthetic: true,
        }),
      });
      const body = (await res.json()) as { error?: string; message?: string; data?: { incident?: SceneIncident; deduplicated?: boolean } };
      if (!res.ok) {
        setMessage(body.error || body.message || "The labeled test did not open an incident.");
        return;
      }
      const incident = body.data?.incident;
      if (incident?.priority === "critical" && incident.status === "UNVERIFIED") {
        signalIqVisionNavAlert({ eventId: incident.id });
      }
      if (incident) setSelectedId(incident.id);
      setMessage(
        body.data?.deduplicated
          ? "An open incident already exists for this camera and category. A second incident was not created."
          : "TEST incident created. It is unverified, and no CAD record was created.",
      );
      await queryClient.invalidateQueries({ queryKey: ["scene-incidents"] });
    } catch {
      setMessage("The scene incident service did not respond.");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: string, extra: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/vision/scene-incidents/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setMessage(body.error || body.message || "The action was not saved.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["scene-incidents"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <h2 className="text-sm font-semibold text-white">Scene Intelligence training categories</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {EXAMPLES.map((item) => (
            <article key={item.title} className="rounded-md border border-slate-800 p-3">
              <h3 className="text-sm font-medium text-white">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{item.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Illustrative categories only. They are not training data and not proof of accuracy. Dataset and model work is in the administrator Model Training Studio, not on this call-taking screen.
        </p>
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-white">Labeled test</h2>
        <p className="mt-1 text-xs text-slate-500">
          This opens one preliminary iQ Vision incident marked TEST. It notifies the watch desk. It does not interrupt a call-taker&apos;s active 911 call, and it does not create a CAD incident.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">
            Category
            <select className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
              {TEST_CATEGORIES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Frames
            <input className="mt-1 block w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" type="number" min={0} max={30} value={frames} onChange={(event) => setFrames(Number(event.target.value))} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={negative} onChange={(event) => setNegative(event.target.checked)} />
            Negative example
          </label>
          <button type="button" disabled={busy} onClick={() => void runTest()} className="rounded bg-red-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Run labeled test
          </button>
        </div>
        {message ? <p className="mt-2 text-xs text-amber-100">{message}</p> : null}
      </section>

      {selected ? (
        <section className="rounded-lg border border-slate-800 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
            {selected.synthetic ? "TEST — " : ""}
            {selected.label}
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white">
            iQ Vision incident {selected.id}
          </h2>
          <p className="text-xs text-slate-400">
            {selected.zoneLabel} · {selected.cameraName} · {selected.status} · model {selected.modelVersion}
          </p>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-300">Live activity log</h3>
          <p className="mt-1 text-xs text-slate-500">Audio transcript is not shown. This camera record has no authorized audio source, so no speech was generated.</p>
          <ol className="mt-2 space-y-2">
            {selected.activityLog.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="text-xs text-slate-300">
                <span className="text-slate-500">{entry.at.slice(11, 19)} — {entry.actor === "OPERATOR" ? "Dispatcher" : entry.actor === "SYSTEM" ? "System" : "Scene Intelligence"}</span>
                <span className="mt-0.5 block">{entry.text}</span>
                {entry.verified ? null : <span className="text-amber-200/80">Unverified machine observation.</span>}
              </li>
            ))}
          </ol>
          {selected.logFinalized ? (
            <p className="mt-3 text-xs text-slate-500">The pre-dispatch log is finalized.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" disabled={busy} onClick={() => void act("acknowledge", {})}>Acknowledge</button>
                <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" disabled={busy} onClick={() => void act("review", {})}>Start review</button>
              </div>
              <label className="block text-xs text-slate-400">
                Verification note
                <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" disabled={busy} onClick={() => void act("verify", { note })}>Verify observation</button>
              <label className="block text-xs text-slate-400">
                Dismissal reason
                <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" disabled={busy} onClick={() => void act("dismiss", { reason })}>Dismiss incident</button>
              <label className="block text-xs text-slate-400">
                Existing CAD incident id
                <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={cadId} onChange={(event) => setCadId(event.target.value)} placeholder="Entered by a person" />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={cadConfirmed} onChange={(event) => setCadConfirmed(event.target.checked)} />
                I confirm this dispatch through the existing CAD workflow
              </label>
              <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" disabled={busy} onClick={() => void act("authorize_dispatch", { linkedCadIncidentId: cadId, cadConfirmed })}>
                Authorize dispatch
              </button>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-slate-500">No preliminary scene incidents are stored for this agency.</p>
      )}
    </div>
  );
}
