"use client";

import { useState } from "react";
import type { CreateCompanyBody, RelationshipType, ContactVertical } from "rapid-cortex-shared";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CreateCompanyBody) => Promise<void>;
};

export function AddCompanyModal({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("prospect");
  const [verticals, setVerticals] = useState<ContactVertical[]>(["venue"]);
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [hq, setHq] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        relationshipType,
        verticals,
        industry: industry.trim() || null,
        website: website.trim() || null,
        hq: hq.trim() || null,
        phone: phone.trim() || null,
        linkedInUrl: linkedInUrl.trim() || null,
        notes: notes.trim() || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onClose();
      setName("");
      setNotes("");
      setTags("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setBusy(false);
    }
  }

  function toggleVertical(v: ContactVertical) {
    setVerticals((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-white">Add Company</h2>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block">
            <span className="text-slate-400">Company Name *</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-slate-400">Relationship Type *</span>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            >
              {(["prospect", "partner", "competitor", "vendor", "influencer", "customer"] as const).map(
                (t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ),
              )}
            </select>
          </label>
          <div>
            <span className="text-slate-400">Verticals</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {(["911", "campus", "venue", "transit", "all"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVertical(v)}
                  className={`rounded-full border px-2 py-1 text-[11px] ${
                    verticals.includes(v)
                      ? "border-sky-500 bg-sky-500/20 text-sky-200"
                      : "border-slate-700 text-slate-400"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          {(
            [
              ["Industry", industry, setIndustry],
              ["Website", website, setWebsite],
              ["HQ Location", hq, setHq],
              ["Phone", phone, setPhone],
              ["LinkedIn URL", linkedInUrl, setLinkedInUrl],
            ] as const
          ).map(([label, value, setter]) => (
            <label key={label} className="block">
              <span className="text-slate-400">{label}</span>
              <input
                value={value}
                onChange={(e) => setter(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-slate-400">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-slate-400">Tags (comma-separated)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
