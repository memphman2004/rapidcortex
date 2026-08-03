"use client";

import { useEffect, useRef, useState } from "react";
import { STATUS_CONFIG, type JobApplication } from "rapid-cortex-shared";
import { addNote, getResumeDownloadUrl, patchApplication } from "@/lib/hiring/applicants-api";

type Tab = "details" | "notes";

const STAR_RATINGS = [1, 2, 3, 4, 5] as const;

export function ApplicantDetailPanel({
  application: app,
  onClose,
  onUpdated,
  onOpenMoveModal,
}: {
  application: JobApplication;
  onClose: () => void;
  onUpdated: (a: JobApplication) => void;
  onOpenMoveModal: () => void;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const [noteText, setNoteText] = useState("");
  const [pinNote, setPinNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const cfg = STATUS_CONFIG[app.status];

  useEffect(() => {
    setTab("details");
    setNoteText("");
    setError(null);
  }, [app.applicationId]);

  async function handleRating(rating: 1 | 2 | 3 | 4 | 5) {
    setBusy(true);
    try {
      const updated = await patchApplication(app.applicationId, { rating });
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set rating");
    } finally { setBusy(false); }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await addNote(app.applicationId, noteText.trim(), pinNote);
      onUpdated(updated);
      setNoteText("");
      setPinNote(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add note");
    } finally { setBusy(false); }
  }

  async function handleResumeDownload() {
    setResumeBusy(true);
    try {
      const url = await getResumeDownloadUrl(app.applicationId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError("Could not retrieve resume link.");
    } finally { setResumeBusy(false); }
  }

  const initials = `${app.firstName?.[0] ?? ""}${app.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="flex w-[360px] shrink-0 flex-col border-l border-slate-800 bg-[#090f1f]">

      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-900 text-sm font-bold text-sky-300">
            {initials}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-100">{app.firstName} {app.lastName}</div>
            <div className="text-[11px] text-slate-500">{app.email}</div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">✕</button>
      </div>

      {/* ── Status + actions ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${cfg.bgClass} ${cfg.textClass}`}>
          {cfg.label}
        </span>
        <button
          type="button"
          onClick={onOpenMoveModal}
          className="ml-auto rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:border-sky-500 hover:text-sky-300"
        >
          Move Stage →
        </button>
      </div>

      {/* ── Star Rating ── */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 px-4 py-2.5">
        <span className="text-[10px] text-slate-500 mr-1">Rating</span>
        {STAR_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleRating(r)}
            className={`text-lg transition ${
              (app.rating ?? 0) >= r ? "text-amber-400 hover:text-amber-300" : "text-slate-700 hover:text-slate-500"
            }`}
          >
            ★
          </button>
        ))}
        {app.rating && (
          <span className="ml-1 text-[10px] text-slate-500">{app.rating}/5</span>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-800">
        {(["details", "notes"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex-1 py-2 text-[11px] font-medium capitalize transition",
              tab === t ? "border-b-2 border-sky-500 text-sky-400" : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {t}{t === "notes" && (app.notes?.length ?? 0) > 0 ? ` (${app.notes!.length})` : ""}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Details tab */}
        {tab === "details" && (
          <div className="space-y-4 p-4">

            {/* Resume */}
            {app.resumeFileName && (
              <section>
                <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Resume</h3>
                <button
                  type="button"
                  onClick={handleResumeDownload}
                  disabled={resumeBusy}
                  className="flex w-full items-center gap-2.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-2.5 text-left hover:border-slate-600 disabled:opacity-50 transition"
                >
                  <span className="text-lg">📄</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-200">{app.resumeFileName}</div>
                    <div className="text-[10px] text-slate-500">{resumeBusy ? "Opening…" : "Click to download / view"}</div>
                  </div>
                </button>
              </section>
            )}

            {/* Contact info */}
            <section>
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Contact</h3>
              <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-900/40 p-3">
                {[
                  { label: "Email", value: app.email, href: `mailto:${app.email}` },
                  { label: "Phone", value: app.phone, href: app.phone ? `tel:${app.phone}` : undefined },
                  { label: "LinkedIn", value: app.linkedInUrl, href: app.linkedInUrl },
                ].map(({ label, value, href }) =>
                  value ? (
                    <div key={label} className="flex gap-2">
                      <span className="w-14 shrink-0 text-[10px] text-slate-600">{label}</span>
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="truncate text-[11px] text-sky-400 hover:underline">
                          {value}
                        </a>
                      ) : (
                        <span className="truncate text-[11px] text-slate-300">{value}</span>
                      )}
                    </div>
                  ) : null
                )}
              </div>
            </section>

            {/* Screening */}
            <section>
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Screening</h3>
              <div className="space-y-1.5 rounded-md border border-slate-800 bg-slate-900/40 p-3">
                {[
                  { label: "Experience", value: app.yearsExperience },
                  { label: "Availability", value: app.weeklyAvailability ? `${app.weeklyAvailability} hrs/week` : undefined },
                  { label: "Source", value: app.source?.replace(/_/g, " ") },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label} className="flex gap-2">
                      <span className="w-20 shrink-0 text-[10px] text-slate-600">{label}</span>
                      <span className="text-[11px] text-slate-300">{value}</span>
                    </div>
                  ) : null
                )}
              </div>
            </section>

            {/* Cover note */}
            {app.coverNote && (
              <section>
                <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Cover Note</h3>
                <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {app.coverNote}
                </div>
              </section>
            )}

            {/* Timeline */}
            <section>
              <h3 className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">Timeline</h3>
              <div className="space-y-1">
                {(app.activities ?? []).map((act) => (
                  <div key={act.activityId} className="flex gap-2 text-[10px]">
                    <span className="text-slate-600 shrink-0">{new Date(act.createdAt).toLocaleDateString()}</span>
                    <span className="text-slate-400">{act.description}</span>
                  </div>
                ))}
                {(app.activities?.length ?? 0) === 0 && (
                  <p className="text-[10px] text-slate-600">No activity recorded yet.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Notes tab */}
        {tab === "notes" && (
          <div className="flex flex-col gap-3 p-4">
            {/* Note composer */}
            <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3">
              <textarea
                ref={noteRef}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this applicant…"
                rows={4}
                className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-600 outline-none resize-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-500">
                  <input type="checkbox" checked={pinNote} onChange={(e) => setPinNote(e.target.checked)} className="accent-sky-500" />
                  Pin note
                </label>
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || busy}
                  className="rounded bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
                >
                  {busy ? "Saving…" : "Add Note"}
                </button>
              </div>
            </div>

            {/* Existing notes */}
            {(app.notes ?? [])
              .slice()
              .sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return Date.parse(b.createdAt) - Date.parse(a.createdAt);
              })
              .map((note) => (
                <div
                  key={note.noteId}
                  className={[
                    "rounded-md border p-3",
                    note.pinned ? "border-amber-500/30 bg-amber-500/5" : "border-slate-800 bg-slate-900/30",
                  ].join(" ")}
                >
                  {note.pinned && <div className="mb-1 text-[9px] font-bold text-amber-400">📌 PINNED</div>}
                  <p className="text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap">{note.text}</p>
                  <div className="mt-2 text-[9px] text-slate-600">
                    {note.authorName} · {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}

            {(app.notes?.length ?? 0) === 0 && (
              <p className="text-center text-[11px] text-slate-600">No notes yet.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div className="border-t border-red-900/40 bg-red-950/30 px-4 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
