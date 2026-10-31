"use client";

import { useRef, useState } from "react";
import {
  DISCOVERY_SOURCE_POLICY,
  DISCOVERY_SUGGESTIONS,
  SEARCH_EXPANSION,
  STUDIO_CATEGORIES,
  assessTrainingRights,
  buildDatasetVersion,
  planVideoClip,
  trainingLicenseNote,
  trainingReadiness,
  type DiscoveryCandidate,
  type RightsRecord,
  type StudioCategoryId,
} from "@/lib/rapid-vision/model-studio";

const LAB_TABS = ["Discover", "Images", "Videos", "Video lab", "Review queue", "Gap analysis", "Sources"] as const;
type LabTab = (typeof LAB_TABS)[number];

const ENVIRONMENTS = ["", "parking garage", "campus", "school", "stadium", "airport", "transit", "street", "entrance", "corridor", "warehouse", "park"];
const LIGHTING = ["", "day", "night", "low light", "indoor", "backlit", "infrared"];

type QueueItem = { candidate: DiscoveryCandidate; category: StudioCategoryId };

export function WebDiscoveryLab() {
  const [lab, setLab] = useState<LabTab>("Discover");
  const [category, setCategory] = useState<StudioCategoryId>("firearm_like");
  const [source, setSource] = useState("wikimedia");
  const [media, setMedia] = useState("video");
  const [environment, setEnvironment] = useState("");
  const [lighting, setLighting] = useState("");
  const [minDuration, setMinDuration] = useState(0);
  const [minWidth, setMinWidth] = useState(0);
  const [query, setQuery] = useState(SEARCH_EXPANSION.firearm_like[0].query);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [reviews, setReviews] = useState<Record<string, { ok: boolean; reason: string }>>({});
  const [rights, setRights] = useState<Record<string, RightsRecord>>({});
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(10);
  const [clipNote, setClipNote] = useState<string | null>(null);
  const [datasetNote, setDatasetNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const player = useRef<HTMLVideoElement>(null);

  const selected = candidates.find((item) => item.id === selectedId) ?? queue.find((item) => item.candidate.id === selectedId)?.candidate ?? null;
  const images = candidates.filter((item) => item.mediaType === "image");
  const videos = candidates.filter((item) => item.mediaType === "video" || item.hasVideo);
  const labeled = queue.map((item) => ({
    category: item.category,
    sceneFit: item.candidate.sceneFit,
    title: item.candidate.title,
    mediaType: item.candidate.mediaType,
    role: item.candidate.exampleRole,
    lighting: null,
    cameraAngle: null,
    rights: rights[item.candidate.id]?.status ?? assessTrainingRights(item.candidate).status,
  }));
  const approvedForTraining = labeled.filter((item) => item.rights === "APPROVED_FOR_TRAINING").length;

  function chooseCategory(next: StudioCategoryId) {
    setCategory(next);
    setQuery(SEARCH_EXPANSION[next][0]?.query ?? DISCOVERY_SUGGESTIONS[next][0] ?? "");
  }

  async function search(nextQuery = query, nextCategory = category, nextMedia = media) {
    setBusy(true);
    setNotice(null);
    setClipNote(null);
    try {
      const res = await fetch("/api/rc-admin/vision/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category: nextCategory, query: nextQuery, source: nextMedia === "video" && source === "openverse" ? "wikimedia" : source, media: nextMedia, environment, lighting, minDuration, minWidth, limit: 12 }),
      });
      const body = (await res.json()) as { candidates?: DiscoveryCandidate[]; notice?: string; error?: string };
      setCandidates(body.candidates ?? []);
      setReviews({});
      setNotice(body.error || body.notice || (res.ok ? null : "Discovery did not return candidates."));
      if ((body.candidates ?? []).some((item) => item.mediaType === "video" || item.hasVideo)) setLab("Videos");
      else if ((body.candidates ?? []).length > 0) setLab("Images");
    } catch {
      setCandidates([]);
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
    const body = (await res.json()) as { ok?: boolean; reason?: string; error?: string };
    setReviews((current) => ({ ...current, [candidate.id]: { ok: Boolean(body.ok), reason: body.reason || body.error || "Review was not recorded." } }));
  }

  async function recordRights(candidate: DiscoveryCandidate, rightsDecision: "verify-license" | "approve-import" | "approve-training" | "reject") {
    const res = await fetch("/api/rc-admin/vision/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "record-rights", candidate, rightsDecision, rights: rights[candidate.id] }),
    });
    const body = (await res.json()) as { ok?: boolean; reason?: string; record?: RightsRecord };
    if (body.record) setRights((current) => ({ ...current, [candidate.id]: body.record as RightsRecord }));
    setReviews((current) => ({ ...current, [candidate.id]: { ok: Boolean(body.ok), reason: body.reason || "Rights review was not recorded." } }));
  }

  async function requestImport(candidate: DiscoveryCandidate) {
    const res = await fetch("/api/rc-admin/vision/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "import-media", rights: rights[candidate.id] ?? assessTrainingRights(candidate) }),
    });
    const body = (await res.json()) as { reason?: string };
    setReviews((current) => ({ ...current, [candidate.id]: { ok: false, reason: body.reason || "Import was refused." } }));
  }

  function findExamples(nextCategory: StudioCategoryId) {
    const card = trainingReadiness(nextCategory, labeled, false);
    setCategory(nextCategory);
    setQuery(card.search.query);
    setMedia(card.search.media);
    if (card.search.media === "video") setSource("wikimedia");
    setLab("Discover");
    void search(card.search.query, nextCategory, card.search.media);
  }

  function addToQueue(candidate: DiscoveryCandidate) {
    setQueue((current) => current.some((item) => item.candidate.id === candidate.id) ? current : [...current, { candidate, category }]);
    setLab("Review queue");
  }

  function openLab(candidate: DiscoveryCandidate) {
    setSelectedId(candidate.id);
    setClipStart(0);
    setClipEnd(candidate.durationSeconds ? Math.min(10, candidate.durationSeconds) : 10);
    setClipNote(null);
    setLab("Video lab");
  }

  function noteClip() {
    const duration = selected?.durationSeconds ?? null;
    setClipNote(planVideoClip({ durationSeconds: duration, startSeconds: clipStart, endSeconds: clipEnd }).reason);
  }

  function stepFrame(direction: 1 | -1) {
    const video = player.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, video.currentTime + direction / 30);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Scene Intelligence — Web Discovery Lab</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">Discover, review, and prepare visual training data for intelligent scene monitoring. A search result is not an incident, and a license check is not approval to train.</p>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-slate-800" aria-label="Web Discovery Lab">
        {LAB_TABS.map((item) => (
          <button key={item} type="button" onClick={() => setLab(item)} className={`border-b-2 px-3 py-2 text-sm ${lab === item ? "border-violet-400 text-violet-100" : "border-transparent text-slate-400"}`}>{item}</button>
        ))}
      </nav>

      {lab === "Discover" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={category} onChange={(event) => chooseCategory(event.target.value as StudioCategoryId)} aria-label="Detection category">
              {STUDIO_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source">
              <option value="wikimedia">Wikimedia Commons</option>
              <option value="internetarchive">Internet Archive</option>
              <option value="huggingface">Hugging Face datasets</option>
              <option value="openverse">Openverse images</option>
            </select>
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={media} onChange={(event) => setMedia(event.target.value)} aria-label="Media">
              <option value="video">Videos</option>
              <option value="image">Images</option>
              <option value="dataset">Datasets</option>
            </select>
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={environment} onChange={(event) => setEnvironment(event.target.value)} aria-label="Environment, matched on titles after search">
              <option value="">Any environment</option>
              {ENVIRONMENTS.filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={lighting} onChange={(event) => setLighting(event.target.value)} aria-label="Lighting, matched on titles after search">
              <option value="">Any lighting</option>
              {LIGHTING.filter(Boolean).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={minDuration} onChange={(event) => setMinDuration(Number(event.target.value))} aria-label="Minimum duration">
              <option value={0}>Any duration</option>
              <option value={5}>At least 5 seconds</option>
              <option value={15}>At least 15 seconds</option>
            </select>
            <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" value={minWidth} onChange={(event) => setMinWidth(Number(event.target.value))} aria-label="Minimum width">
              <option value={0}>Any resolution</option>
              <option value={640}>At least 640 wide</option>
              <option value={1280}>At least 1280 wide</option>
            </select>
          </div>
          <p className="max-w-3xl text-xs text-slate-400">{STUDIO_CATEGORIES.find((item) => item.id === category)?.observable}</p>
          <div className="flex flex-wrap gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} aria-label="Discovery query" className="min-w-[18rem] flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" />
            <button type="button" disabled={busy || query.trim().length === 0} onClick={() => void search()} className="rounded bg-violet-800 px-3 py-1 text-sm disabled:opacity-50">{busy ? "Searching" : "Search"}</button>
          </div>
          <p className="text-xs text-slate-500">Environment and lighting match words in the title after the provider responds. They are not provider filters. Suggested searches are instructions, not evidence that an event occurred.</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_EXPANSION[category].map((concept) => (
              <button key={concept.query} type="button" onClick={() => { setQuery(concept.query); void search(concept.query); }} className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                {concept.role === "negative" ? "Lookalike" : "Target"} · {concept.query}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {notice ? <p className="text-sm text-amber-100">{notice}</p> : null}

      {lab === "Images" || lab === "Videos" ? (
        <CandidateGrid
          items={lab === "Images" ? images : videos}
          reviews={reviews}
          rights={rights}
          onReview={review}
          onRights={recordRights}
          onImport={requestImport}
          onQueue={addToQueue}
          onOpen={openLab}
        />
      ) : null}

      {lab === "Video lab" ? (
        <div className="space-y-3 rounded-lg border border-slate-800 p-3">
          {selected?.playbackUrl ? (
            <video ref={player} key={selected.playbackUrl} src={selected.playbackUrl} controls preload="metadata" className="max-h-[420px] w-full rounded bg-black" />
          ) : (
            <p className="text-sm text-slate-400">{selected ? "This result has a source page and no playable file. Internet Archive items are not downloaded, and no analyzer ran." : "Choose a video from the Videos tab. No recording is loaded."}</p>
          )}
          <p className="text-xs text-slate-500">No analyzer is connected. Nothing on this screen is a detected event, a medical finding, or a training label.</p>
          {selected ? (
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <label className="text-xs text-slate-400">Start seconds
                <input type="number" min={0} step={0.1} value={clipStart} onChange={(event) => setClipStart(Number(event.target.value))} className="mt-1 block w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
              </label>
              <label className="text-xs text-slate-400">End seconds
                <input type="number" min={0} step={0.1} value={clipEnd} onChange={(event) => setClipEnd(Number(event.target.value))} className="mt-1 block w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
              </label>
              <button type="button" className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => stepFrame(-1)} disabled={!selected.playbackUrl}>Previous frame</button>
              <button type="button" className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => stepFrame(1)} disabled={!selected.playbackUrl}>Next frame</button>
              <button type="button" className="rounded border border-slate-700 px-2 py-1 text-xs" onClick={() => { if (player.current) player.current.playbackRate = 0.5; }} disabled={!selected.playbackUrl}>Half speed</button>
              <button type="button" className="rounded bg-slate-800 px-2 py-1 text-xs" onClick={noteClip}>Note clip interval</button>
              <a className="text-xs text-violet-300 underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">View source</a>
            </div>
          ) : null}
          {clipNote ? <p className="text-sm text-amber-100">{clipNote}</p> : null}
          {selected ? <p className="text-xs text-slate-500">{selected.title} · {trainingLicenseNote(selected.license)} · Not approved for training</p> : null}
        </div>
      ) : null}

      {lab === "Review queue" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">This queue lasts for this browser session. It is not a stored dataset, and nothing here is approved for training.</p>
          {queue.length === 0 ? <p className="text-sm text-slate-500">No candidates have been added.</p> : (
            <CandidateGrid items={queue.map((item) => item.candidate)} reviews={reviews} rights={rights} onReview={review} onRights={recordRights} onImport={requestImport} onQueue={addToQueue} onOpen={openLab} />
          )}
          <button type="button" className="rounded bg-slate-800 px-3 py-1.5 text-sm" onClick={() => setDatasetNote(buildDatasetVersion({ approvedForTraining }).reason)}>Create dataset version</button>
          {datasetNote ? <p className="text-sm text-amber-100">{datasetNote}</p> : null}
        </div>
      ) : null}

      {lab === "Gap analysis" ? (
        <div className="space-y-3">
          <p className="max-w-3xl text-sm text-slate-400">No versioned dataset is stored. These cards count rights decisions in this session. Lighting and camera angle stay unknown until someone labels them. This is not a detection-accuracy score.</p>
          <p className="text-xs text-slate-500">Approved for training: {approvedForTraining}. Annotated frames: 0. Held-out evaluation: not stored.</p>
          <ul className="space-y-3">
            {STUDIO_CATEGORIES.map((item) => {
              const card = trainingReadiness(item.id, labeled, false);
              return (
                <li key={item.id} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-amber-200">{card.headline}</p>
                    </div>
                    <button type="button" className="rounded bg-violet-800 px-2 py-1 text-xs" onClick={() => findExamples(item.id)}>Find training examples</button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {card.factors.map((factor) => (
                      <li key={factor.name} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-slate-300">{factor.name}</span>
                        <span className="text-right text-slate-400">{factor.detail}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {lab === "Sources" ? (
        <ul className="space-y-2">
          {DISCOVERY_SOURCE_POLICY.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-800 px-3 py-2">
              <p className="text-sm font-medium">{item.name} · {item.state}</p>
              <p className="text-xs text-slate-400">{item.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CandidateGrid({
  items,
  reviews,
  rights,
  onReview,
  onRights,
  onImport,
  onQueue,
  onOpen,
}: {
  items: DiscoveryCandidate[];
  reviews: Record<string, { ok: boolean; reason: string }>;
  rights: Record<string, RightsRecord>;
  onReview: (candidate: DiscoveryCandidate, decision: "approve" | "reject") => void;
  onRights: (candidate: DiscoveryCandidate, decision: "verify-license" | "approve-import" | "approve-training" | "reject") => void;
  onImport: (candidate: DiscoveryCandidate) => void;
  onQueue: (candidate: DiscoveryCandidate) => void;
  onOpen: (candidate: DiscoveryCandidate) => void;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-500">No results in this view. Nothing was added to a dataset.</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {items.map((candidate) => {
        const reviewed = reviews[candidate.id];
        const right = rights[candidate.id] ?? assessTrainingRights(candidate);
        const size = candidate.width && candidate.height ? `${candidate.width} × ${candidate.height}` : null;
        const duration = candidate.durationSeconds ? `${Math.round(candidate.durationSeconds)}s` : null;
        return (
          <li key={candidate.id} className="rounded-lg border border-slate-800 p-3">
            {candidate.previewUrl ? <img src={candidate.previewUrl} alt="" className="mb-2 h-36 w-full rounded bg-slate-950 object-contain" /> : null}
            <p className="text-sm font-medium">{candidate.title}</p>
            <p className="mt-1 text-xs text-slate-400">{candidate.source} · {candidate.mediaType} · {candidate.license} · {trainingLicenseNote(candidate.license)}</p>
            <p className="mt-1 text-xs text-slate-500">{candidate.fitNote}</p>
            <p className="mt-1 text-xs text-slate-500">{candidate.creator}{size ? ` · ${size}` : ""}{duration ? ` · ${duration}` : ""}{candidate.exampleRole === "negative" ? " · Lookalike search" : ""}</p>
            <p className="mt-1 text-xs text-amber-200">{right.status.replaceAll("_", " ")} · {right.evidence}</p>
            {reviewed ? <p className={`mt-2 text-xs ${reviewed.ok ? "text-emerald-200" : "text-amber-100"}`}>{reviewed.reason}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <a className="text-xs text-violet-300 underline" href={candidate.sourceUrl} target="_blank" rel="noreferrer">View source</a>
              {candidate.mediaType === "video" || candidate.hasVideo ? <button type="button" className="text-xs text-slate-300" onClick={() => onOpen(candidate)}>Open in lab</button> : null}
              <button type="button" className="text-xs text-slate-300" onClick={() => onQueue(candidate)}>Add to review queue</button>
              {right.status === "REVIEW_REQUIRED" ? <button type="button" className="text-xs text-slate-300" onClick={() => onRights(candidate, "verify-license")}>Verify license</button> : null}
              {right.status === "LICENSE_VERIFIED" ? <button type="button" className="text-xs text-slate-300" onClick={() => onRights(candidate, "approve-import")}>Approve import</button> : null}
              {right.status === "APPROVED_FOR_IMPORT" ? <button type="button" className="text-xs text-slate-300" onClick={() => onRights(candidate, "approve-training")}>Approve training</button> : null}
              {right.status === "APPROVED_FOR_IMPORT" || right.status === "APPROVED_FOR_TRAINING" ? <button type="button" className="text-xs text-slate-300" onClick={() => onImport(candidate)}>Import</button> : null}
              {candidate.trainable ? <button type="button" disabled={Boolean(reviewed)} className="text-xs text-slate-300 disabled:opacity-40" onClick={() => onReview(candidate, "approve")}>Approve for review</button> : null}
              <button type="button" className="text-xs text-slate-500" onClick={() => onRights(candidate, "reject")}>Reject</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
