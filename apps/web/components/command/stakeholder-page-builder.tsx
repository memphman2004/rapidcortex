"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PatchStakeholderPageBody,
  StakeholderPageInternal,
  StakeholderSection,
  StakeholderVisibility,
} from "rapid-cortex-shared";
import { defaultStakeholderSections } from "rapid-cortex-shared";
import {
  createStakeholderPage,
  fetchStakeholderPage,
  isStakeholderApiConfigured,
  patchStakeholderPage,
  publicStakeholderStatusUrl,
} from "@/lib/stakeholder-api";
import { isStakeholderPagesEnabled } from "@/lib/runtime-flags";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function StakeholderPageBuilder({
  incidentId,
  pageId,
  open,
  onClose,
  onSaved,
}: {
  incidentId: string;
  pageId?: string | null;
  open: boolean;
  onClose: () => void;
  onSaved?: (page: StakeholderPageInternal) => void;
}) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [visibility, setVisibility] = useState<StakeholderVisibility>("link_only");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [sections, setSections] = useState<StakeholderSection[]>(defaultStakeholderSections());
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!pageId) {
      setTitle("");
      setSlug("");
      setVisibility("link_only");
      setPassword("");
      setExpiresAt("");
      setSections(defaultStakeholderSections());
      return;
    }
    void fetchStakeholderPage(pageId)
      .then((p) => {
        setTitle(p.title);
        setSlug(p.slug);
        setVisibility(p.visibility);
        setExpiresAt(p.expiresAt?.slice(0, 16) ?? "");
        setSections(p.sections);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [open, pageId]);

  const shareUrl = useMemo(() => (slug ? publicStakeholderStatusUrl(slug) : ""), [slug]);

  const toggleSection = (sectionId: string, visible: boolean) => {
    setSections((prev) => prev.map((s) => (s.sectionId === sectionId ? { ...s, visible } : s)));
  };

  const addCustomSection = () => {
    if (!customTitle.trim() || !customBody.trim()) return;
    setSections((prev) => [
      ...prev,
      {
        sectionId: `custom-${Date.now()}`,
        kind: "custom_text",
        title: customTitle.trim(),
        content: customBody.trim(),
        visible: true,
      },
    ]);
    setCustomTitle("");
    setCustomBody("");
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: PatchStakeholderPageBody = {
        title,
        slug,
        visibility,
        sections,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (visibility === "password" && password) body.password = password;

      const saved = pageId
        ? await patchStakeholderPage(pageId, body)
        : await createStakeholderPage({
            incidentId,
            title,
            slug,
            visibility,
            sections,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
            password: visibility === "password" ? password : undefined,
          });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-white">
          {pageId ? "Edit status page" : "Create status page"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">Share incident updates with external stakeholders.</p>

        <div className="mt-4 space-y-3 text-xs">
          <label className="block text-slate-400">
            Title
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!pageId && !slug) setSlug(slugify(e.target.value));
              }}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
            />
          </label>
          <label className="block text-slate-400">
            Slug (URL)
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="bridge-mvc-may-13"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-100"
            />
          </label>
          <label className="block text-slate-400">
            Visibility
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as StakeholderVisibility)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
            >
              <option value="public">Public</option>
              <option value="link_only">Link only</option>
              <option value="password">Password protected</option>
            </select>
          </label>
          {visibility === "password" ? (
            <label className="block text-slate-400">
              Page password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
              />
            </label>
          ) : null}
          <label className="block text-slate-400">
            Expires (optional)
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
            />
          </label>

          <div>
            <p className="font-medium text-slate-300">Sections</p>
            <ul className="mt-2 space-y-1">
              {sections
                .filter((s) => s.kind !== "custom_text")
                .map((s) => (
                  <li key={s.sectionId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={s.visible}
                      onChange={(e) => toggleSection(s.sectionId, e.target.checked)}
                    />
                    <span className="text-slate-300">{s.title}</span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded border border-slate-800 p-2">
            <p className="text-slate-400">Custom text section</p>
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Section title"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            />
            <textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              rows={3}
              placeholder="Public-facing text…"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
            />
            <button
              type="button"
              onClick={addCustomSection}
              className="mt-1 text-sky-400 hover:text-sky-300"
            >
              Add section
            </button>
          </div>
        </div>

        {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded bg-teal-900/70 px-3 py-1.5 text-xs font-medium text-teal-100 ring-1 ring-teal-700 disabled:opacity-40"
          >
            Save
          </button>
          {slug ? (
            <>
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Preview
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                {copied ? "Copied!" : "Copy share link"}
              </button>
            </>
          ) : null}
          <button type="button" onClick={onClose} className="text-xs text-slate-500">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateStakeholderPageButton({ incidentId }: { incidentId: string }) {
  const [open, setOpen] = useState(false);
  if (!isStakeholderPagesEnabled() || !isStakeholderApiConfigured()) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
      >
        Create status page
      </button>
      <StakeholderPageBuilder incidentId={incidentId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
