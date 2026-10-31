"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnnotationStage, inspectImageElement, type PreviewInspection } from "@/components/rc-admin/annotation-stage";
import { boxesMatch, roundStudioBox } from "@/lib/rapid-vision/annotation-geometry";
import type { StudioBox, StudioReviewRecord, StudioReviewStatus } from "@/lib/rapid-vision/studio-dataset";
import { validStudioBox } from "@/lib/rapid-vision/studio-review-gates";

type Readiness = {
  candidates: number;
  labelsVerified: number;
  awaitingReview: number;
  training: { ready: boolean; launched: false; reason: string };
};

type QueuePayload = {
  storage?: "dynamodb" | "unavailable";
  reviews?: StudioReviewRecord[];
  datasets?: { id: string; version: number; assetIds: string[]; reviewer: string; createdAt: string }[];
  gaps?: { category: string; need: string }[];
  readiness?: Readiness;
  liveDetection?: "disabled";
  batchEnabled?: boolean;
  error?: string;
};

type Notice = { ok: boolean; text: string };

const FILTERS: { id: "ALL" | StudioReviewStatus; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "REVIEW_REQUIRED", label: "Awaiting review" },
  { id: "CORRECTION_REQUESTED", label: "Correction" },
  { id: "APPROVED", label: "Accepted" },
  { id: "REJECTED", label: "Rejected" },
];

export function StudioReadiness() {
  const { payload, error } = useStudioQueue();
  if (error) return <p className="text-sm text-amber-100">{error}</p>;
  if (!payload?.readiness) return <p className="text-sm text-slate-400">Loading the review queue…</p>;
  const ready = payload.readiness;
  return (
    <section className="rounded-xl border border-slate-800 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Model Training Studio</h2>
          <p className="text-xs text-slate-500">Counts are the records stored for this studio. Live detection is off.</p>
        </div>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">Live records</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Count label="Candidates stored" value={ready.candidates} />
        <Count label="Labels verified" value={ready.labelsVerified} />
        <Count label="Awaiting review" value={ready.awaitingReview} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Dataset readiness</p>
        <span className="rounded-full bg-orange-900/60 px-2 py-0.5 text-[11px] font-medium text-orange-200">
          {ready.training.ready ? "Ready to price" : "Not ready for training"}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{ready.training.reason}</p>
    </section>
  );
}

export function StudioReviewQueue() {
  const { payload, error, reload } = useStudioQueue();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [estimate, setEstimate] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [magnifier, setMagnifier] = useState(false);

  const reviews = useMemo(() => {
    const rows = payload?.reviews ?? [];
    if (filter === "ALL") return rows;
    return rows.filter((item) => item.status === filter);
  }, [filter, payload?.reviews]);

  const selected = reviews.find((item) => item.id === selectedId) ?? reviews[0] ?? null;
  const selectedIndex = selected ? reviews.findIndex((item) => item.id === selected.id) : 0;

  const step = useCallback((delta: number) => {
    if (reviews.length === 0) return;
    const next = (selectedIndex + delta + reviews.length) % reviews.length;
    setSelectedId(reviews[next]?.id ?? null);
  }, [reviews, selectedIndex]);

  useEffect(() => {
    if (reviews.length === 0) return;
    if (!reviews.some((item) => item.id === selectedId)) setSelectedId(reviews[0].id);
  }, [reviews, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "m" || event.key === "M") {
        setMagnifier((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  async function act(body: Record<string, unknown>) {
    setNotice(null);
    const res = await fetch("/api/rc-admin/vision/intelligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; reason?: string; error?: string; estimatedUsd?: number; generated?: boolean };
    if (!res.ok || data.ok === false) setNotice({ ok: false, text: data.reason || data.error || "The change was not saved." });
    else if (data.generated === false) setNotice({ ok: true, text: data.reason || "No image was generated from this page." });
    else setNotice({ ok: true, text: "Saved. The studio table has this change. Live detection stayed off." });
    await reload();
  }

  async function showEstimate() {
    const res = await fetch("/api/rc-admin/vision/intelligence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "plan-batch", category: "firearm_like", count: 10 }),
    });
    const data = (await res.json()) as { estimatedUsd?: number; reason?: string; positive?: number; negative?: number; challenging?: number };
    const mix = data.positive != null ? ` Mix ${data.positive} positive, ${data.negative} lookalikes, ${data.challenging} challenging.` : "";
    setEstimate(`Estimated planner cost $${(data.estimatedUsd ?? 0).toFixed(2)} for 10 images.${mix} ${data.reason ?? ""} This page does not start generation.`);
  }

  if (error) return <p className="text-sm text-amber-100">{error}</p>;
  if (!payload) return <p className="text-sm text-slate-400">Loading the review queue…</p>;

  const ready = payload.readiness;
  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${notice.ok ? "border-emerald-800 bg-emerald-950/50 text-emerald-100" : "border-rose-800 bg-rose-950/50 text-rose-100"}`}>
          {notice.text}
        </p>
      ) : null}
      {ready ? (
        <section className="rounded-xl border border-slate-800 bg-black/40 p-4">
          <h2 className="text-sm font-semibold">Review totals</h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Count label="Candidates stored" value={ready.candidates} />
            <Count label="Labels verified" value={ready.labelsVerified} />
            <Count label="Awaiting review" value={ready.awaitingReview} />
          </div>
          <p className="mt-3 text-xs text-slate-400">{ready.training.reason}</p>
        </section>
      ) : null}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Labeling workspace</h2>
          <p className="text-xs text-slate-500">
            {payload.storage === "dynamodb" ? "Loaded from the studio table." : "The studio table could not be read."} Live detection is disabled. One box is stored per candidate.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-2 py-1 text-[11px] ${filter === item.id ? "bg-violet-800 text-white" : "bg-slate-900 text-slate-400"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {reviews.length === 0 || !selected ? <p className="text-sm text-slate-500">No candidates in this filter.</p> : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" className="rounded border border-slate-700 px-2 py-1" onClick={() => step(-1)}>Previous</button>
                <button type="button" className="rounded border border-slate-700 px-2 py-1" onClick={() => step(1)}>Next</button>
                <span className="text-slate-400">{selectedIndex + 1} of {reviews.length}</span>
                <span className="text-slate-500">Arrow keys move between images. M toggles the magnifier.</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <button type="button" aria-pressed={magnifier} className={`rounded border px-2 py-1 ${magnifier ? "border-violet-400 text-violet-100" : "border-slate-700"}`} onClick={() => setMagnifier((value) => !value)}>
                  Magnifier
                </button>
                <label className="flex items-center gap-2">
                  Brightness
                  <input aria-label="Preview brightness" type="range" min={0.4} max={3} step={0.05} value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
                </label>
                <label className="flex items-center gap-2">
                  Contrast
                  <input aria-label="Preview contrast" type="range" min={0.4} max={2.5} step={0.05} value={contrast} onChange={(event) => setContrast(Number(event.target.value))} />
                </label>
                <button type="button" className="rounded border border-slate-700 px-2 py-1" onClick={() => { setBrightness(1); setContrast(1); }}>Reset preview</button>
              </div>
              <p className="text-[11px] text-slate-500">Brightness and contrast change this preview only. The stored image is not modified.</p>
              <CandidateEditor
                key={selected.id}
                item={selected}
                brightness={brightness}
                contrast={contrast}
                magnifier={magnifier}
                onAct={act}
              />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {reviews.map((item, index) => (
                  <GalleryThumb key={item.id} item={item} selected={item.id === selected.id} index={index} onSelect={() => setSelectedId(item.id)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-slate-800 p-4 text-sm">
        <h2 className="font-semibold">Coverage</h2>
        <ul className="mt-2 space-y-1 text-slate-400">
          {(payload.gaps ?? []).map((gap) => (
            <li key={`${gap.category}-${gap.need}`}>{gap.category}: {gap.need}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Missing real footage can be searched in Discovery Lab. Synthetic fill stays unapproved until a person verifies the label.
        </p>
      </section>
      <section className="rounded-xl border border-slate-800 p-4 text-sm">
        <h2 className="font-semibold">Dataset version</h2>
        {(payload.datasets ?? []).length === 0 ? <p className="mt-2 text-slate-400">No immutable dataset version is stored.</p> : (
          <ul className="mt-2 space-y-1 text-slate-300">
            {payload.datasets?.map((version) => (
              <li key={version.id}>{version.id} · {version.assetIds.length} verified assets · {version.reviewer}</li>
            ))}
          </ul>
        )}
        <button type="button" className="mt-3 rounded bg-slate-800 px-3 py-1.5 text-xs" onClick={() => void act({ action: "assemble-dataset" })}>
          Assemble verified examples
        </button>
      </section>
      <section className="rounded-xl border border-slate-800 p-4 text-sm">
        <h2 className="font-semibold">10-image firearm-like batch</h2>
        <p className="mt-1 text-slate-400">Four firearm-like shapes, four harmless lookalikes, two low-light or partly blocked examples. Nothing is approved automatically.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded bg-slate-800 px-3 py-1.5 text-xs" onClick={() => void showEstimate()}>Show cost estimate</button>
          <button type="button" className="rounded bg-slate-800 px-3 py-1.5 text-xs" onClick={() => void act({ action: "confirm-batch", category: "firearm_like", count: 10, confirmed: true })}>
            Confirm estimate
          </button>
        </div>
        {estimate ? <p className="mt-2 text-xs text-amber-100">{estimate}</p> : null}
        <p className="mt-2 text-xs text-slate-500">Batch generation on this server is {payload.batchEnabled ? "enabled" : "closed"}. Confirming does not call the image model from the browser.</p>
      </section>
    </div>
  );
}

function CandidateEditor({
  item,
  brightness,
  contrast,
  magnifier,
  onAct,
}: {
  item: StudioReviewRecord;
  brightness: number;
  contrast: number;
  magnifier: boolean;
  onAct: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<StudioBox | null>(item.box ?? null);
  const [category, setCategory] = useState(item.category);
  const [author, setAuthor] = useState(item.author ?? "");
  const [license, setLicense] = useState(item.license ?? "");
  const [privacy, setPrivacy] = useState(item.privacy ?? "");
  const [commercialUse, setCommercialUse] = useState(item.commercialUse ?? "unverified");
  const [comment, setComment] = useState("");
  const [cannotIdentify, setCannotIdentify] = useState(false);
  const [inspection, setInspection] = useState<PreviewInspection>("loading");

  const boxSaved = boxesMatch(draft, item.box ?? null);
  const verifyReason = verificationBlock({ item, draft, boxSaved, cannotIdentify, inspection, category });
  const area = draft ? draft.width * draft.height : 0;

  function updateField(key: keyof StudioBox, value: number) {
    const base = draft ?? { x: 0, y: 0, width: 0.1, height: 0.1 };
    setDraft(roundStudioBox({ ...base, [key]: value }));
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <AnnotationStage
        src={previewSrc(item.id)}
        candidateId={item.id}
        box={draft}
        brightness={brightness}
        contrast={contrast}
        magnifier={magnifier}
        onInspection={setInspection}
        onBoxChange={setDraft}
        onCommit={(box) => void onAct({ action: "correct-box", id: item.id, box })}
      />
      <aside className="space-y-4 rounded-xl border border-slate-800 p-3 text-sm">
        <div>
          <p className="font-medium">{item.id}</p>
          <p className="mt-1 text-xs text-slate-400">{item.synthetic ? "Synthetic source" : "Public source"} · {item.modelId || "source model unset"}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <Fact label="Category" value={item.category} />
          <Fact label="Role" value={item.role ?? "unset"} />
          <Fact label="Rights" value={item.rightsVerifiedAt ? item.rightsStatus : `${item.rightsStatus} · not recorded`} />
          <Fact label="Label" value={item.trainingLabel ? "Verified" : "Unverified"} />
        </dl>
        {item.sourceUrl ? <p className="break-all text-[11px] text-slate-500">{item.sourceUrl}</p> : null}
        <section className="space-y-2 border-t border-slate-800 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rights</h3>
          <p className="text-[11px] text-slate-500">Recording rights does not verify the training label.</p>
          {item.synthetic ? (
            <button type="button" className="w-full rounded bg-slate-800 px-2 py-1.5 text-xs" onClick={() => void onAct({ action: "verify-rights", id: item.id, rights: { privacy: "Synthetic image. No agency footage and no person." } })}>
              Record synthetic rights
            </button>
          ) : (
            <div className="grid gap-1">
              <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Author or publisher" className="rounded border border-slate-800 bg-transparent px-2 py-1 text-xs" />
              <input value={license} onChange={(event) => setLicense(event.target.value)} placeholder="License" className="rounded border border-slate-800 bg-transparent px-2 py-1 text-xs" />
              <input value={privacy} onChange={(event) => setPrivacy(event.target.value)} placeholder="Privacy restrictions" className="rounded border border-slate-800 bg-transparent px-2 py-1 text-xs" />
              <select value={commercialUse} onChange={(event) => setCommercialUse(event.target.value as typeof commercialUse)} className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs">
                <option value="unverified">Commercial use unverified</option>
                <option value="permitted">Commercial training permitted</option>
                <option value="not_permitted">Commercial training not permitted</option>
              </select>
              <button type="button" className="rounded bg-slate-800 px-2 py-1.5 text-xs" onClick={() => void onAct({ action: "verify-rights", id: item.id, rights: { sourceUrl: item.sourceUrl, author, license, privacy, commercialUse } })}>
                Record media rights
              </button>
            </div>
          )}
        </section>
        <section className="space-y-2 border-t border-slate-800 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Box</h3>
          <p className="text-[11px] text-slate-500">Draw, drag, or resize on the image. These numbers stay in fractions of the frame.</p>
          <div className="grid grid-cols-4 gap-1">
            {(["x", "y", "width", "height"] as const).map((key) => (
              <label key={key} className="text-[10px] text-slate-500">
                {key}
                <input
                  aria-label={`Box ${key}`}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={draft ? draft[key] : ""}
                  onChange={(event) => updateField(key, Number(event.target.value))}
                  className="mt-1 w-full rounded border border-slate-800 bg-transparent px-1 py-1 text-xs"
                />
              </label>
            ))}
          </div>
          {area > 0.45 ? <p className="text-[11px] text-amber-200">This box covers a large share of the frame. Tighten it if the object is smaller.</p> : null}
          <label className="flex items-start gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={cannotIdentify} onChange={(event) => setCannotIdentify(event.target.checked)} />
            The object cannot be identified in this image
          </label>
          <div className="flex gap-2">
            <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => void onAct({ action: "correct-box", id: item.id, box: draft })}>Save box</button>
            <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => { setDraft(null); void onAct({ action: "correct-box", id: item.id, box: null }); }}>Delete box</button>
          </div>
        </section>
        <section className="space-y-2 border-t border-slate-800 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Decision</h3>
          <label className="block text-[11px] text-slate-500">
            Category
            <input value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded border border-slate-800 bg-transparent px-2 py-1 text-xs" />
          </label>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Reviewer comment" rows={2} className="w-full rounded border border-slate-800 bg-transparent px-2 py-1 text-xs" />
          <button type="button" className="w-full rounded bg-emerald-800 px-2 py-1.5 text-xs font-medium" onClick={() => void onAct({ action: "review-decision", id: item.id, decision: "approve" })}>Accept candidate</button>
          <button type="button" className="w-full rounded bg-rose-900 px-2 py-1.5 text-xs font-medium" onClick={() => void onAct({ action: "review-decision", id: item.id, decision: "reject", note: comment })}>Reject</button>
          <button type="button" className="w-full rounded bg-amber-800 px-2 py-1.5 text-xs font-medium" onClick={() => void onAct({ action: "review-decision", id: item.id, decision: "correct-label", note: category })}>Correct label</button>
          <button type="button" className="w-full rounded bg-sky-900 px-2 py-1.5 text-xs font-medium" onClick={() => void onAct({ action: "review-decision", id: item.id, decision: "request-review", note: comment })}>Request review</button>
          <button
            type="button"
            disabled={verifyReason != null}
            className="w-full rounded bg-violet-800 px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            onClick={() => void onAct({ action: "verify-label", id: item.id, note: comment, identifiable: cannotIdentify ? false : true })}
          >
            Verify label
          </button>
          <p className="text-[11px] text-slate-400">{verifyReason ?? "Verify only after rights are recorded, the candidate is accepted, and the box matches the object."}</p>
          <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={() => void onAct({ action: "comment", id: item.id, note: comment })}>Save comment</button>
        </section>
        <section className="border-t border-slate-800 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Review history</h3>
          {(item.audit ?? []).length > 0 ? (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-slate-400">
              {item.audit?.map((entry, index) => (
                <li key={`${entry.at}-${index}`}>{entry.at} · {entry.reviewer} · {entry.action}{entry.note ? ` · ${entry.note}` : ""}</li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[11px] text-slate-500">No audit history stored on this candidate yet.</p>}
        </section>
      </aside>
    </div>
  );
}

function verificationBlock(input: {
  item: StudioReviewRecord;
  draft: StudioBox | null;
  boxSaved: boolean;
  cannotIdentify: boolean;
  inspection: PreviewInspection;
  category: string;
}): string | null {
  if (input.inspection === "failed") return "The preview failed, so the label cannot be verified.";
  if (input.inspection === "black") return "The preview is almost black. Do not verify the label until the object is visible.";
  if (input.inspection === "loading") return "The image is still loading.";
  if (input.cannotIdentify) return "The object cannot be identified. Reject the candidate or request another review.";
  if (!validStudioBox(input.draft)) return "Draw a box around the object before verifying the label.";
  if (!input.boxSaved) return "Save the box before verifying the label.";
  if (!input.category.trim()) return "A category is required before the label can be verified.";
  if (!input.item.rightsVerifiedAt || input.item.rightsStatus === "REVIEW_REQUIRED" || input.item.rightsStatus === "UNKNOWN" || input.item.rightsStatus === "RESTRICTED") {
    return "Record rights before verifying the label. Rights approval and label verification stay separate.";
  }
  if (!input.item.approved || input.item.status !== "APPROVED") return "Accept the candidate before verifying its label.";
  return null;
}

function GalleryThumb({ item, selected, index, onSelect }: { item: StudioReviewRecord; selected: boolean; index: number; onSelect: () => void }) {
  const [state, setState] = useState<"ready" | "black" | "failed">("ready");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      aria-label={`Open candidate ${index + 1} ${item.id}`}
      className={`relative h-16 w-20 shrink-0 overflow-hidden rounded border ${selected ? "border-violet-400" : "border-slate-800"}`}
    >
      {state === "failed" ? (
        <span className="flex h-full items-center px-1 text-[10px] text-rose-200">Preview failed</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc(item.id)}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setState("failed")}
          onLoad={(event) => {
            const inspection = inspectImageElement(event.currentTarget);
            if (inspection === "black") setState("black");
          }}
        />
      )}
      {state === "black" ? <span className="absolute inset-x-0 bottom-0 bg-black/80 text-[10px] text-amber-200">Dark preview</span> : null}
    </button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function previewSrc(id: string): string {
  return `/api/rc-admin/vision/intelligence?preview=${encodeURIComponent(id)}`;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

function useStudioQueue() {
  const [payload, setPayload] = useState<QueuePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/rc-admin/vision/intelligence");
    const body = (await res.json()) as QueuePayload;
    if (!res.ok) {
      setError(body.error || "The review queue did not load.");
      return;
    }
    setError(null);
    setPayload(body);
  }, []);
  useEffect(() => {
    void reload().catch(() => setError("The review queue did not load."));
  }, [reload]);
  return { payload, error, reload };
}
