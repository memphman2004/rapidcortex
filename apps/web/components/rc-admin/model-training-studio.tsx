"use client";

import { useState } from "react";
import { STUDIO_CATEGORIES } from "@/lib/rapid-vision/model-studio";
import { WebDiscoveryLab } from "@/components/rc-admin/web-discovery-lab";
import { IntelligenceProviders } from "@/components/rc-admin/intelligence-providers";
import { StudioReadiness, StudioReviewQueue } from "@/components/rc-admin/studio-review-queue";

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
  "Discovery Lab",
  "Intelligence Providers",
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
      {tab === "Overview" ? <Overview onOpen={() => setTab("Discovery Lab")} /> : null}
      {tab === "Detection Categories" ? <Categories /> : null}
      {tab === "Training Datasets" ? <Datasets /> : null}
      {tab === "Labeling" ? <Labeling /> : null}
      {tab === "Training Jobs" ? <TrainingJobs /> : null}
      {tab === "Evaluation" ? <EmptyPanel title="Model evaluation" body="No evaluation report is stored. A finished training job would land here for precision, recall, false alerts, and missed events. None of those numbers are available." /> : null}
      {tab === "Model Registry" ? <EmptyPanel title="Model registry" body="No model artifact is registered. Production eligibility is Not Approved for every category." /> : null}
      {tab === "Camera Deployment" ? <Deployment /> : null}
      {tab === "Feedback" ? <EmptyPanel title="Feedback and improvements" body="Dispatcher review notes are not copied into a training set automatically. A new model still needs evaluation and approval." /> : null}
      {tab === "Audit" ? <EmptyPanel title="Audit history" body="Approval and deployment decisions will appear here when a model record is stored. No production activation has been recorded." /> : null}
      {tab === "Discovery Lab" ? <WebDiscoveryLab /> : null}
      {tab === "Intelligence Providers" ? <IntelligenceProviders /> : null}
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
      <StudioReadiness />
      <button type="button" onClick={onOpen} className="rounded bg-violet-800 px-3 py-1.5 text-sm">Open Discovery Lab</button>
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
  return <StudioReviewQueue />;
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


function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">{body}</p>
    </section>
  );
}
