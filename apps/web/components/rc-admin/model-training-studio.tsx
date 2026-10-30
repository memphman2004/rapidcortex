"use client";

import { useState } from "react";
import { STUDIO_CATEGORIES, type DiscoveryCandidate } from "@/lib/rapid-vision/model-studio";

const TABS = [
  "Overview",
  "Detection Categories",
  "Training Datasets",
  "Labeling",
  "Training Jobs",
  "Evaluation",
  "Model Registry",
  "Camera Deployment",
  "Feedback",
  "Audit",
  "Web Discovery",
] as const;

type Tab = (typeof TABS)[number];

export function ModelTrainingStudio() {
  const [tab, setTab] = useState<Tab>("Overview");
  return (
    <div className="space-y-4 text-slate-100">
      <nav className="flex flex-wrap gap-1 border-b border-slate-800" aria-label="Model Training Studio">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`border-b-2 px-3 py-2 text-sm ${tab === item ? "border-violet-400 text-violet-100" : "border-transparent text-slate-400"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === "Overview" ? <Overview onOpen={() => setTab("Web Discovery")} /> : null}
      {tab === "Detection Categories" ? <Categories /> : null}
      {tab === "Training Datasets" ? <Datasets /> : null}
      {tab === "Labeling" ? <Labeling /> : null}
      {tab === "Training Jobs" ? <TrainingJobs /> : null}
      {tab === "Evaluation" ? <EmptyPanel title="Model evaluation" body="No evaluation report is stored. A finished training job would land here for precision, recall, false alerts, and missed events. None of those numbers are available." /> : null}
      {tab === "Model Registry" ? <EmptyPanel title="Model registry" body="No model artifact is registered. Production eligibility is Not Approved for every category." /> : null}
      {tab === "Camera Deployment" ? <Deployment /> : null}
      {tab === "Feedback" ? <EmptyPanel title="Feedback and improvements" body="Dispatcher review notes are not copied into a training set automatically. A new model still needs evaluation and approval." /> : null}
      {tab === "Audit" ? <EmptyPanel title="Audit history" body="Approval and deployment decisions will appear here when a model record is stored. No production activation has been recorded." /> : null}
      {tab === "Web Discovery" ? <WebDiscovery /> : null}
    </div>
  );
}

function Overview({ onOpen }: { onOpen: () => void }) {
  const stats = [
    ["Registered models", "0"],
    ["Production models", "0"],
    ["Training now", "0"],
    ["Awaiting evaluation", "0"],
    ["Awaiting approval", "0"],
    ["Rejected versions", "0"],
  ];
  return (
    <section className="space-y-3">
      <p className="max-w-3xl text-sm text-slate-400">
        Training is separate from live monitoring. Dispatchers review alerts in iQ Vision. This studio does not open Scene Incidents from a search result, and it does not create CAD records.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-[#0c1220] px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">These counts are the model records on file. Zero means none are registered, not that detection is accurate.</p>
      <button type="button" onClick={onOpen} className="rounded bg-violet-800 px-3 py-1.5 text-sm">Open Web Discovery</button>
    </section>
  );
}

function Categories() {
  return (
    <ul className="space-y-2">
      {STUDIO_CATEGORIES.map((category) => (
        <li key={category.id} className="rounded-lg border border-slate-800 p-3">
          <p className="text-sm font-medium">{category.name}</p>
          <p className="mt-1 text-xs text-slate-400">{category.observable}</p>
          <p className="mt-1 text-[11px] text-amber-200">Approval status: not approved · Model version: none · {category.annotation}</p>
        </li>
      ))}
    </ul>
  );
}

function Datasets() {
  return (
    <EmptyPanel
      title="Training datasets"
      body="No dataset version is stored. Upload of agency footage stays off until a reviewed dataset bucket and malware scan are connected. Web Discovery can find licensed candidates, and those files are not copied here automatically."
    />
  );
}

function Labeling() {
  return (
    <EmptyPanel
      title="Image and video labeling"
      body="CVAT remains the labeling tool for boxes, tracks, and video intervals. This studio does not draw boxes on an empty canvas and call them annotations. Negative examples — phones, tools, toys, exercise, and ordinary crowds — are required before a dataset can be marked training-ready."
    />
  );
}

function TrainingJobs() {
  const [message, setMessage] = useState<string | null>(null);
  async function start() {
    const res = await fetch("/api/rc-admin/vision/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start-training", datasetReady: false }),
    });
    const body = (await res.json()) as { reason?: string; error?: string; progress?: null };
    setMessage(body.reason || body.error || "The training service did not start a job.");
  }
  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-400">SageMaker is the planned trainer. Lambda will not train a vision model. A job stays unstarted until the training backend returns an id.</p>
      <button type="button" onClick={() => void start()} className="rounded bg-slate-800 px-3 py-1.5 text-sm">Request training job</button>
      {message ? <p className="text-sm text-amber-100">{message}</p> : null}
    </section>
  );
}

function Deployment() {
  const [message, setMessage] = useState<string | null>(null);
  async function activate() {
    const res = await fetch("/api/rc-admin/vision/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "activate-production", phase: "DRAFT" }),
    });
    const body = (await res.json()) as { reason?: string; error?: string };
    setMessage(body.reason || body.error || "Production activation was refused.");
  }
  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-400">No camera is assigned a production model. Shadow mode and production rollout stay closed until an artifact, an evaluation, and an approver exist.</p>
      <button type="button" onClick={() => void activate()} className="rounded bg-slate-800 px-3 py-1.5 text-sm">Activate production</button>
      {message ? <p className="text-sm text-amber-100">{message}</p> : null}
    </section>
  );
}

function WebDiscovery() {
  const [category, setCategory] = useState("firearm_like");
  const [source, setSource] = useState("openverse");
  const [media, setMedia] = useState("image");
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/rc-admin/vision/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, source, media, limit: 12 }),
      });
      const body = (await res.json()) as { candidates?: DiscoveryCandidate[]; notice?: string; error?: string };
      setCandidates(body.candidates ?? []);
      setNotice(body.error || body.notice || null);
    } catch {
      setNotice("Discovery did not respond. No files were downloaded.");
    } finally {
      setBusy(false);
    }
  }

  async function review(candidate: DiscoveryCandidate, decision: "approve" | "reject") {
    const res = await fetch("/api/rc-admin/vision/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "review-candidate", candidate, decision }),
    });
    const body = (await res.json()) as { reason?: string; error?: string };
    setNotice(body.reason || body.error || "Review was not recorded.");
  }

  return (
    <section className="space-y-3">
      <p className="max-w-3xl text-sm text-slate-400">
        Search approved sources for candidates. A ceiling-camera night scene is not the same as a studio photo, so discovered images only bootstrap a dataset. Customer cameras still need their own authorized footage before a model can be considered.
      </p>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
          {STUDIO_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="openverse">Openverse</option>
          <option value="wikimedia">Wikimedia Commons</option>
          <option value="huggingface">Hugging Face datasets</option>
        </select>
        <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={media} onChange={(event) => setMedia(event.target.value)}>
          <option value="image">Images</option>
          <option value="text">Public text</option>
        </select>
        <button type="button" disabled={busy} onClick={() => void search()} className="rounded bg-violet-800 px-3 py-1 text-sm disabled:opacity-50">Search</button>
      </div>
      {notice ? <p className="text-sm text-amber-100">{notice}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {candidates.map((candidate) => (
          <li key={candidate.id} className="rounded-lg border border-slate-800 p-3">
            <p className="text-sm font-medium">{candidate.title}</p>
            <p className="mt-1 text-xs text-slate-400">{candidate.source} · {candidate.license} · {candidate.trainable ? "License may allow review" : "Not eligible for training"}</p>
            <p className="mt-1 text-xs text-slate-500">{candidate.creator}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="text-xs text-violet-300 underline" href={candidate.sourceUrl} target="_blank" rel="noreferrer">View source</a>
              <button type="button" className="text-xs text-slate-300" onClick={() => void review(candidate, "approve")}>Approve for review</button>
              <button type="button" className="text-xs text-slate-500" onClick={() => void review(candidate, "reject")}>Reject</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">{body}</p>
    </section>
  );
}
