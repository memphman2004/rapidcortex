"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ENGAGEMENT_LABEL,
  LOCATION_LABEL,
  STATUS_BADGE,
  formatCompensation,
  type EngagementType,
  type JobPosting,
  type PostingStatus,
  type WorkLocation,
} from "rapid-cortex-shared";
import { marketingSiteOrigin } from "@/lib/marketing-links";

const API = "/api/rc-admin/job-postings";
const QK = ["rc-job-postings"] as const;

async function fetchPostings(): Promise<JobPosting[]> {
  const r = await fetch(API, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load postings");
  const { postings } = (await r.json()) as { postings: JobPosting[] };
  return postings;
}
async function createPosting(data: Partial<JobPosting>): Promise<JobPosting> {
  const r = await fetch(API, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to create");
  return r.json();
}
async function updatePosting(postingId: string, data: Partial<JobPosting>): Promise<JobPosting> {
  const r = await fetch(`${API}/${postingId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Failed to update");
  return r.json();
}
async function setPostingStatus(postingId: string, status: PostingStatus): Promise<JobPosting> {
  return updatePosting(postingId, { status });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-300">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
const inp =
  "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-sky-500";
const sel = `${inp} cursor-pointer`;

function PostingDrawer({
  initial,
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: Partial<JobPosting>;
  onSave: (data: Partial<JobPosting>) => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<Partial<JobPosting>>(
    initial ?? {
      title: "",
      subtitle: "",
      department: "",
      positionKey: "",
      engagementType: "CONTRACTOR_1099",
      workLocation: "REMOTE_US",
      compensationMax: 22,
      compensationUnit: "HOUR",
      summary: "",
      description: "",
      requirements: [],
      preferredQualifications: [],
      status: "DRAFT",
    },
  );

  const s =
    <K extends keyof JobPosting>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({
        ...p,
        [k]:
          k === "compensationMin" || k === "compensationMax"
            ? e.target.value === ""
              ? undefined
              : Number(e.target.value)
            : e.target.value,
      }));

  const multiline =
    (k: "requirements" | "preferredQualifications") => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      setForm((p) => ({
        ...p,
        [k]: e.target.value
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      }));

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} onKeyDown={() => {}} role="presentation" />
      <div className="flex w-full max-w-[520px] flex-col overflow-hidden border-l border-slate-800 bg-[#090f1f]">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-100">
            {initial?.postingId ? "Edit posting" : "New job posting"}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <Field label="Job title" hint="e.g. Executive Assistant">
            <input className={inp} value={form.title ?? ""} onChange={s("title")} placeholder="Executive Assistant" />
          </Field>
          <Field label="Subtitle / role clarifier" hint="Shown below the title">
            <input
              className={inp}
              value={form.subtitle ?? ""}
              onChange={s("subtitle")}
              placeholder="Startup Operations Coordinator"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <input className={inp} value={form.department ?? ""} onChange={s("department")} placeholder="Operations" />
            </Field>
            <Field label="Position key" hint="Links to applications table">
              <input
                className={inp}
                value={form.positionKey ?? ""}
                onChange={s("positionKey")}
                placeholder="EA_STARTUP_OPS_COORDINATOR"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Engagement type">
              <select className={sel} value={form.engagementType} onChange={s("engagementType")}>
                {(Object.entries(ENGAGEMENT_LABEL) as [EngagementType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Work location">
              <select className={sel} value={form.workLocation} onChange={s("workLocation")}>
                {(Object.entries(LOCATION_LABEL) as [WorkLocation, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min comp">
              <input
                className={inp}
                type="number"
                value={form.compensationMin ?? ""}
                onChange={s("compensationMin")}
                placeholder="—"
              />
            </Field>
            <Field label="Max comp">
              <input
                className={inp}
                type="number"
                value={form.compensationMax ?? ""}
                onChange={s("compensationMax")}
                placeholder="22"
              />
            </Field>
            <Field label="Unit">
              <select className={sel} value={form.compensationUnit ?? "HOUR"} onChange={s("compensationUnit")}>
                <option value="HOUR">/ hour</option>
                <option value="YEAR">/ year</option>
              </select>
            </Field>
          </div>
          <Field label="Summary" hint="2-3 sentences shown on the listing card (plain text)">
            <textarea
              className={`${inp} min-h-[70px] resize-y`}
              value={form.summary ?? ""}
              onChange={s("summary")}
              placeholder="Short lede shown in search results…"
            />
          </Field>
          <Field label="Full description" hint="Markdown supported — full job post body">
            <textarea
              className={`${inp} min-h-[180px] resize-y font-mono text-xs`}
              value={form.description ?? ""}
              onChange={s("description")}
              placeholder="## About the Role"
            />
          </Field>
          <Field label="Required qualifications" hint="One per line">
            <textarea
              className={`${inp} min-h-[90px] resize-y`}
              value={(form.requirements ?? []).join("\n")}
              onChange={multiline("requirements")}
              placeholder="Excellent written and verbal communication"
            />
          </Field>
          <Field label="Preferred qualifications" hint="One per line">
            <textarea
              className={`${inp} min-h-[90px] resize-y`}
              value={(form.preferredQualifications ?? []).join("\n")}
              onChange={multiline("preferredQualifications")}
              placeholder="Executive assistant experience"
            />
          </Field>
        </div>

        <div className="space-y-2 border-t border-slate-800 p-4">
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ ...form, status: "DRAFT" })}
              disabled={busy || !form.title?.trim() || !form.positionKey?.trim()}
              className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => onSave({ ...form, status: "PUBLISHED" })}
              disabled={busy || !form.title?.trim() || !form.positionKey?.trim() || !form.summary?.trim()}
              className="rounded bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-40"
            >
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostingRow({
  posting,
  onEdit,
  onStatus,
}: {
  posting: JobPosting;
  onEdit: () => void;
  onStatus: (s: PostingStatus) => void;
}) {
  const badge = STATUS_BADGE[posting.status];
  const publicCareers = marketingSiteOrigin();
  return (
    <tr className="cursor-default border-b border-slate-900 hover:bg-slate-900/50">
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-100">{posting.title}</div>
        {posting.subtitle ? <div className="text-[11px] text-slate-500">{posting.subtitle}</div> : null}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{ENGAGEMENT_LABEL[posting.engagementType]}</td>
      <td className="px-4 py-3 text-xs text-slate-400">{formatCompensation(posting)}</td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {posting.applicationCount ?? 0} applicant{(posting.applicationCount ?? 0) !== 1 ? "s" : ""}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
          >
            Edit
          </button>
          {posting.status === "PUBLISHED" ? (
            <button
              type="button"
              onClick={() => onStatus("ARCHIVED")}
              className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:text-red-300"
            >
              Archive
            </button>
          ) : posting.status === "DRAFT" ? (
            <button
              type="button"
              onClick={() => onStatus("PUBLISHED")}
              className="rounded border border-emerald-700 px-2.5 py-1 text-[11px] text-emerald-400 hover:text-emerald-200"
            >
              Publish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatus("DRAFT")}
              className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200"
            >
              Restore
            </button>
          )}
          <a
            href={`${publicCareers}/careers/?slug=${encodeURIComponent(posting.slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:text-sky-400"
          >
            Preview ↗
          </a>
        </div>
      </td>
    </tr>
  );
}

export function JobPostingsManagement() {
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState<"new" | JobPosting | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PostingStatus | "all">("all");

  const postsQ = useQuery({ queryKey: QK, queryFn: fetchPostings });
  const postings = postsQ.data ?? [];
  const visible = filter === "all" ? postings : postings.filter((p) => p.status === filter);
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const createM = useMutation({
    mutationFn: createPosting,
    onSuccess: () => {
      invalidate();
      setDrawer(null);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(e instanceof Error ? e.message : "Failed"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<JobPosting> }) => updatePosting(id, data),
    onSuccess: () => {
      invalidate();
      setDrawer(null);
      setDrawerError(null);
    },
    onError: (e) => setDrawerError(e instanceof Error ? e.message : "Failed"),
  });
  const statusM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PostingStatus }) => setPostingStatus(id, status),
    onSuccess: invalidate,
  });

  const counts = {
    all: postings.length,
    PUBLISHED: postings.filter((p) => p.status === "PUBLISHED").length,
    DRAFT: postings.filter((p) => p.status === "DRAFT").length,
    ARCHIVED: postings.filter((p) => p.status === "ARCHIVED").length,
  };

  const publicCareers = `${marketingSiteOrigin()}/careers/`;

  return (
    <div className="-mx-1 flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border border-slate-800 bg-[#060c1a]">
      <div className="flex items-center gap-0 border-b border-slate-800 bg-[#0c1428] px-4 py-2.5">
        {[
          { v: counts.all, label: "TOTAL", color: "text-sky-400" },
          { v: counts.PUBLISHED, label: "PUBLISHED", color: "text-emerald-400" },
          { v: counts.DRAFT, label: "DRAFTS", color: "text-amber-400" },
          { v: counts.ARCHIVED, label: "ARCHIVED", color: "text-slate-500" },
        ].map(({ v, label, color }) => (
          <div key={label} className="border-r border-slate-800 px-5 py-1 first:pl-0 last:border-r-0">
            <div className={`text-xl font-bold leading-none ${color}`}>{v}</div>
            <div className="mt-0.5 text-[10px] tracking-wide text-slate-500">{label}</div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setDrawerError(null);
            setDrawer("new");
          }}
          className="ml-auto rounded-md bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
        >
          + New Posting
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-800 bg-[#0a1428] px-4 py-2">
        {(["all", "PUBLISHED", "DRAFT", "ARCHIVED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={[
              "rounded-full border px-3 py-1 text-[11px] transition",
              filter === s
                ? "border-sky-500 bg-sky-500/10 text-sky-300"
                : "border-slate-800 text-slate-500 hover:border-slate-600",
            ].join(" ")}
          >
            {s === "all" ? `All (${counts.all})` : `${STATUS_BADGE[s].label} (${counts[s]})`}
          </button>
        ))}
        <a
          href={publicCareers}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto rounded-full border border-slate-800 px-3 py-1 text-[11px] text-slate-500 hover:border-sky-500 hover:text-sky-400"
        >
          View public careers page ↗
        </a>
      </div>

      <div className="flex-1 overflow-auto">
        {postsQ.isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-500">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
            <div>No {filter === "all" ? "" : `${filter.toLowerCase()} `}postings.</div>
            <button type="button" onClick={() => setDrawer("new")} className="text-xs text-sky-400 hover:underline">
              Create your first posting →
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead className="sticky top-0 bg-slate-950/95">
              <tr className="border-b border-slate-800">
                {["Position", "Status", "Type", "Compensation", "Applications", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <PostingRow
                  key={p.postingId}
                  posting={p}
                  onEdit={() => {
                    setDrawerError(null);
                    setDrawer(p);
                  }}
                  onStatus={(s) => statusM.mutate({ id: p.postingId, status: s })}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {drawer !== null ? (
        <PostingDrawer
          initial={drawer === "new" ? undefined : drawer}
          busy={createM.isPending || updateM.isPending}
          error={drawerError}
          onClose={() => {
            setDrawer(null);
            setDrawerError(null);
          }}
          onSave={(data) => {
            if (drawer === "new") createM.mutate(data);
            else updateM.mutate({ id: (drawer as JobPosting).postingId, data });
          }}
        />
      ) : null}
    </div>
  );
}
