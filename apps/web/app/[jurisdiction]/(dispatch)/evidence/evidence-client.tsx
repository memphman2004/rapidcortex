"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Eye,
  FileText,
  Lock,
  Plus,
  Scale,
  Shield,
  X,
} from "lucide-react";
import type {
  EvidenceRecord,
  EvidenceStatus,
  EvidenceType,
} from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";

const SURFACE = "bg-[#161b2e] border border-[#1e2130]";
const INPUT =
  "rounded-md border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-[#e2e4ea] placeholder:text-[#6b7280] focus:outline-none focus:ring-1 focus:ring-[#378ADD]";

const TYPE_LABEL: Record<EvidenceType, string> = {
  photo: "Photo",
  video: "Video",
  audio: "Audio",
  document: "Document",
  transcript: "Transcript",
  screen_recording: "Screen",
};

const STATUS_STYLE: Record<EvidenceStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  under_hold: "bg-amber-500/15 text-amber-300",
  released: "bg-sky-500/15 text-sky-300",
  redacted: "bg-purple-500/15 text-purple-300",
  purged: "bg-slate-500/15 text-slate-400",
};

const SOURCE_LABEL: Record<string, string> = {
  caller_upload: "Caller upload",
  dispatcher_capture: "Dispatcher capture",
  system_generated: "System generated",
  body_cam: "Body cam",
  cctv: "CCTV",
};

type Props = { jurisdiction: string; agencyId: string };

export function EvidenceClient({ jurisdiction, agencyId }: Props) {
  const qc = useQueryClient();
  const [incidentId, setIncidentId] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | EvidenceType>("");
  const [statusFilter, setStatusFilter] = useState<"" | EvidenceStatus>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<EvidenceRecord | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [showHold, setShowHold] = useState(false);
  const [showPrForm, setShowPrForm] = useState(false);
  const [prForm, setPrForm] = useState({
    requestorName: "",
    requestorOrg: "",
    requestorEmail: "",
    dueDate: "",
    redactionRequired: false,
  });

  const query = useQuery({
    queryKey: ["feature-evidence", agencyId, incidentId],
    queryFn: () =>
      featureSuiteFetch<{ evidence: EvidenceRecord[]; total: number }>(
        `evidence?incidentId=${encodeURIComponent(incidentId.trim())}`,
      ),
    enabled: Boolean(incidentId.trim()),
  });

  const filtered = useMemo(() => {
    let rows = query.data?.evidence ?? [];
    if (typeFilter) rows = rows.filter((e) => e.evidenceType === typeFilter);
    if (statusFilter) rows = rows.filter((e) => e.status === statusFilter);
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      rows = rows.filter((e) => new Date(e.uploadedAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86_400_000;
      rows = rows.filter((e) => new Date(e.uploadedAt).getTime() <= to);
    }
    return rows;
  }, [query.data, typeFilter, statusFilter, dateFrom, dateTo]);

  const holdMut = useMutation({
    mutationFn: (payload: { id: string; holdReason: string }) =>
      featureSuiteFetch(`evidence/${payload.id}/hold`, {
        method: "POST",
        body: JSON.stringify({ holdReason: payload.holdReason }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-evidence", agencyId, incidentId] });
      setShowHold(false);
      setHoldReason("");
      setSelected(null);
    },
  });

  const downloadMut = useMutation({
    mutationFn: (id: string) =>
      featureSuiteFetch<{ recorded: boolean; downloadUrl?: string }>(
        `evidence/${id}/download`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: (data) => {
      if (data.downloadUrl) window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      void qc.invalidateQueries({ queryKey: ["feature-evidence", agencyId, incidentId] });
    },
  });

  const prMut = useMutation({
    mutationFn: (payload: {
      id: string;
      body: {
        requestorName: string;
        requestorOrg?: string;
        requestorEmail: string;
        dueDate?: string;
        redactionRequired?: boolean;
      };
    }) =>
      featureSuiteFetch(`evidence/${payload.id}/public-records`, {
        method: "POST",
        body: JSON.stringify(payload.body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feature-evidence", agencyId, incidentId] });
      setShowPrForm(false);
      setPrForm({
        requestorName: "",
        requestorOrg: "",
        requestorEmail: "",
        dueDate: "",
        redactionRequired: false,
      });
    },
  });

  const daysRemaining = (purgeAt?: string) => {
    if (!purgeAt) return null;
    const ms = new Date(purgeAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86_400_000));
  };

  return (
    <div className="min-h-full bg-[#0f1117] p-4 text-[#e2e4ea] md:p-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Evidence Chain of Custody</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            Filter, review, hold, and track public-records requests for incident evidence.
          </p>
        </div>
      </header>

      <div className={`${SURFACE} mb-4 grid gap-3 rounded-lg p-4 md:grid-cols-5`}>
        <label className="flex flex-col gap-1 text-xs text-[#9ca3af] md:col-span-2">
          Incident ID
          <input
            className={INPUT}
            value={incidentId}
            onChange={(e) => setIncidentId(e.target.value)}
            placeholder="Required to load evidence"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#9ca3af]">
          Type
          <select
            className={INPUT}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | EvidenceType)}
          >
            <option value="">All</option>
            {(Object.keys(TYPE_LABEL) as EvidenceType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#9ca3af]">
          Status
          <select
            className={INPUT}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | EvidenceStatus)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="under_hold">Hold</option>
            <option value="released">Released</option>
            <option value="redacted">Redacted</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-[#9ca3af]">
            From
            <input
              type="date"
              className={INPUT}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[#9ca3af]">
            To
            <input
              type="date"
              className={INPUT}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      {!incidentId.trim() ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
          Enter an incident ID to load evidence for this agency.
        </div>
      ) : query.isLoading ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#9ca3af]`}>
          Loading evidence…
        </div>
      ) : query.isError ? (
        <div className={`${SURFACE} rounded-lg p-8 text-center text-sm text-[#E24B4A]`}>
          {(query.error as Error).message}
        </div>
      ) : (
        <div className={`${SURFACE} overflow-x-auto rounded-lg`}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[#1e2130] text-xs uppercase tracking-wide text-[#6b7280]">
              <tr>
                <th className="px-4 py-3 font-medium">Incident</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.evidenceId} className="border-b border-[#1e2130]/80 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      className="text-[#378ADD] hover:underline"
                      href={`/${jurisdiction}/dispatcher?incident=${encodeURIComponent(row.incidentId)}`}
                    >
                      {row.incidentId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-[#1a2035] px-2 py-0.5 text-xs">
                      {TYPE_LABEL[row.evidenceType] ?? row.evidenceType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#9ca3af]">
                    {SOURCE_LABEL[row.sourceMethod] ?? row.sourceMethod}
                  </td>
                  <td className="px-4 py-3 text-[#9ca3af]">
                    {new Date(row.uploadedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[row.status]}`}
                    >
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.chain?.length ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md bg-[#1a2035] px-2.5 py-1.5 text-xs hover:bg-[#232a42]"
                      onClick={() => setSelected(row)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#6b7280]">
                    No evidence matches the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <aside className="flex h-full w-full max-w-xl flex-col border-l border-[#1e2130] bg-[#0f1117] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
              <div>
                <h2 className="font-semibold">Evidence detail</h2>
                <p className="text-xs text-[#6b7280]">{selected.evidenceId}</p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-[#9ca3af] hover:bg-[#161b2e]"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div
                className={`rounded-md px-3 py-2 text-sm capitalize ${STATUS_STYLE[selected.status]}`}
              >
                {selected.status === "under_hold" ? (
                  <span className="inline-flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Under hold — purge blocked
                  </span>
                ) : (
                  selected.status.replace(/_/g, " ")
                )}
              </div>

              <div className={`${SURFACE} rounded-lg p-3`}>
                <p className="mb-2 text-xs uppercase tracking-wide text-[#6b7280]">Preview</p>
                {selected.evidenceType === "photo" ? (
                  <div className="flex h-40 items-center justify-center rounded bg-[#1a2035] text-[#6b7280]">
                    <FileText className="mr-2 h-5 w-5" />
                    Photo · {selected.originalFilename ?? selected.mimeType}
                  </div>
                ) : selected.evidenceType === "audio" ? (
                  <div className="rounded bg-[#1a2035] p-4 text-sm text-[#9ca3af]">
                    Audio asset · {selected.mimeType}
                  </div>
                ) : (
                  <div className="rounded bg-[#1a2035] p-4 text-sm text-[#9ca3af]">
                    {TYPE_LABEL[selected.evidenceType]} · {selected.mimeType}
                  </div>
                )}
                <p className="mt-3 break-all font-mono text-[11px] text-[#6b7280]">
                  SHA-256: {selected.sha256Hash}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#378ADD] px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => downloadMut.mutate(selected.evidenceId)}
                  disabled={downloadMut.isPending}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                {selected.status !== "under_hold" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-600/90 px-3 py-1.5 text-xs font-medium text-white"
                    onClick={() => setShowHold(true)}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Place hold
                  </button>
                ) : null}
              </div>

              {showHold ? (
                <div className={`${SURFACE} space-y-2 rounded-lg p-3`}>
                  <label className="block text-xs text-[#9ca3af]">
                    Hold reason
                    <textarea
                      className={`${INPUT} mt-1 w-full`}
                      rows={3}
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    disabled={!holdReason.trim() || holdMut.isPending}
                    onClick={() =>
                      holdMut.mutate({ id: selected.evidenceId, holdReason: holdReason.trim() })
                    }
                  >
                    Confirm hold
                  </button>
                  {holdMut.isError ? (
                    <p className="text-xs text-[#E24B4A]">{(holdMut.error as Error).message}</p>
                  ) : null}
                </div>
              ) : null}

              <section>
                <h3 className="mb-2 text-sm font-semibold">Chain of custody</h3>
                <ol className="space-y-2">
                  {(selected.chain ?? []).map((entry) => (
                    <li
                      key={entry.entryId}
                      className={`${SURFACE} rounded-md px-3 py-2 text-xs`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize text-[#e2e4ea]">
                          {entry.action.replace(/_/g, " ")}
                        </span>
                        <span className="text-[#6b7280]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-[#9ca3af]">
                        {entry.userName} · {entry.userRole}
                      </p>
                      <p className="mt-0.5 text-[#6b7280]">{entry.purpose}</p>
                      {entry.ipAddress ? (
                        <p className="mt-0.5 font-mono text-[10px] text-[#6b7280]">
                          IP {entry.ipAddress}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Public records requests</h3>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-[#1a2035] px-2 py-1 text-xs"
                    onClick={() => setShowPrForm((v) => !v)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New request
                  </button>
                </div>
                {showPrForm ? (
                  <div className={`${SURFACE} mb-3 space-y-2 rounded-lg p-3`}>
                    <input
                      className={`${INPUT} w-full`}
                      placeholder="Requestor name"
                      value={prForm.requestorName}
                      onChange={(e) =>
                        setPrForm((f) => ({ ...f, requestorName: e.target.value }))
                      }
                    />
                    <input
                      className={`${INPUT} w-full`}
                      placeholder="Organization"
                      value={prForm.requestorOrg}
                      onChange={(e) =>
                        setPrForm((f) => ({ ...f, requestorOrg: e.target.value }))
                      }
                    />
                    <input
                      className={`${INPUT} w-full`}
                      placeholder="Email"
                      type="email"
                      value={prForm.requestorEmail}
                      onChange={(e) =>
                        setPrForm((f) => ({ ...f, requestorEmail: e.target.value }))
                      }
                    />
                    <input
                      className={`${INPUT} w-full`}
                      type="datetime-local"
                      value={prForm.dueDate}
                      onChange={(e) => setPrForm((f) => ({ ...f, dueDate: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-xs text-[#9ca3af]">
                      <input
                        type="checkbox"
                        checked={prForm.redactionRequired}
                        onChange={(e) =>
                          setPrForm((f) => ({ ...f, redactionRequired: e.target.checked }))
                        }
                      />
                      Redaction required
                    </label>
                    <button
                      type="button"
                      className="rounded-md bg-[#1D9E75] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      disabled={
                        !prForm.requestorName.trim() ||
                        !prForm.requestorEmail.trim() ||
                        prMut.isPending
                      }
                      onClick={() =>
                        prMut.mutate({
                          id: selected.evidenceId,
                          body: {
                            requestorName: prForm.requestorName.trim(),
                            requestorOrg: prForm.requestorOrg.trim() || undefined,
                            requestorEmail: prForm.requestorEmail.trim(),
                            dueDate: prForm.dueDate
                              ? new Date(prForm.dueDate).toISOString()
                              : undefined,
                            redactionRequired: prForm.redactionRequired,
                          },
                        })
                      }
                    >
                      Submit request
                    </button>
                    {prMut.isError ? (
                      <p className="text-xs text-[#E24B4A]">{(prMut.error as Error).message}</p>
                    ) : null}
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {(selected.publicRecordsRequests ?? []).map((req) => (
                    <li key={req.requestId} className={`${SURFACE} rounded-md px-3 py-2 text-xs`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Scale className="h-3.5 w-3.5 text-[#378ADD]" />
                          {req.requestorName}
                        </span>
                        <span className="capitalize text-[#9ca3af]">
                          {req.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-[#6b7280]">
                        {req.requestorOrg ? `${req.requestorOrg} · ` : ""}
                        {req.requestorEmail}
                      </p>
                      <p className="text-[#6b7280]">
                        Requested {new Date(req.requestedAt).toLocaleDateString()}
                        {req.dueDate
                          ? ` · Due ${new Date(req.dueDate).toLocaleDateString()}`
                          : ""}
                      </p>
                    </li>
                  ))}
                  {(selected.publicRecordsRequests ?? []).length === 0 ? (
                    <p className="text-xs text-[#6b7280]">No public records requests yet.</p>
                  ) : null}
                </ul>
              </section>

              <section className={`${SURFACE} rounded-lg p-3 text-xs text-[#9ca3af]`}>
                <p>
                  Retention: {selected.retentionDays} days
                  {selected.purgeAt
                    ? ` · Purge ${new Date(selected.purgeAt).toLocaleDateString()}`
                    : ""}
                  {daysRemaining(selected.purgeAt) != null
                    ? ` · ${daysRemaining(selected.purgeAt)} days remaining`
                    : ""}
                </p>
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
