"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { isApiConfigured } from "@/lib/api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  deleteDiversionWorkflow,
  listDiversionSessions,
  listDiversionWorkflows,
  rotateDiversionConfig,
  upsertDiversionWorkflow,
} from "@/lib/ng911/ng911-api";
import { isNg911AssistEnabled } from "@/lib/runtime-flags";

function canManageDiversion(role: string | undefined): boolean {
  return (
    role === "agencyadmin" ||
    role === "agencyit" ||
    role === "supervisor" ||
    role === "rcsuperadmin" ||
    role === "rcadmin"
  );
}

const emptyForm = {
  name: "",
  description: "",
  intents: "",
  portalUrl: "",
  smsTemplate: "",
  enabled: true,
};

export default function AdminDiversionPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const workflowsQuery = useQuery({
    queryKey: ["ng911-workflows"],
    queryFn: listDiversionWorkflows,
    enabled: Boolean(user && isApiConfigured() && isNg911AssistEnabled() && canManageDiversion(user.role)),
  });

  const sessionsQuery = useQuery({
    queryKey: ["ng911-sessions"],
    queryFn: () => listDiversionSessions(50),
    enabled: Boolean(user && isApiConfigured() && isNg911AssistEnabled() && canManageDiversion(user.role)),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      upsertDiversionWorkflow({
        workflowId: editingId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        intents: form.intents
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        portalUrl: form.portalUrl.trim(),
        smsTemplate: form.smsTemplate.trim() || undefined,
        enabled: form.enabled,
      }),
    onSuccess: async () => {
      setMessage({ tone: "ok", text: editingId ? "Workflow updated." : "Workflow created." });
      setForm(emptyForm);
      setEditingId(undefined);
      await qc.invalidateQueries({ queryKey: ["ng911-workflows"] });
    },
    onError: (e: Error) => setMessage({ tone: "error", text: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDiversionWorkflow(id),
    onSuccess: async () => {
      setMessage({ tone: "ok", text: "Workflow deleted." });
      await qc.invalidateQueries({ queryKey: ["ng911-workflows"] });
    },
    onError: (e: Error) => setMessage({ tone: "error", text: e.message }),
  });

  const rotateMut = useMutation({
    mutationFn: () => rotateDiversionConfig({ enabled: true }),
    onSuccess: async (result) => {
      setPlainKey(result.publicKey);
      setMessage({
        tone: "ok",
        text: "Public diversion key rotated. Copy it now — it is shown only once.",
      });
    },
    onError: (e: Error) => setMessage({ tone: "error", text: e.message }),
  });

  if (!user) return null;

  if (!canManageDiversion(user.role)) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">You do not have permission to manage diversion workflows.</p>
      </div>
    );
  }

  if (!isNg911AssistEnabled()) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <h1 className="text-lg font-semibold text-white">Non-emergency diversion</h1>
        <p className="max-w-xl text-sm text-slate-400">
          NG9-1-1 assist is not enabled for this agency. Contact Rapid Cortex support to turn it on.
        </p>
        <Link href={to("/admin")} className="text-sm text-sky-400 hover:underline">
          ← Admin overview
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400/90">NG9-1-1 assist</p>
        <h1 className="text-lg font-semibold text-white">Non-emergency diversion</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Configure Arlington-style utterance matching and SMS portal links for non-emergency callers.
          Public entry: <code className="text-slate-300">/diversion/{user.agencyId}</code>
        </p>
        <p className="mt-2 text-sm">
          <Link href={to("/admin")} className="text-sky-400 hover:underline">
            ← Admin overview
          </Link>
          {" · "}
          <Link href={to("/admin/ng911/metrics")} className="text-sky-400 hover:underline">
            Call-processing metrics
          </Link>
        </p>
      </div>

      {message ? (
        <p className={message.tone === "ok" ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
          {message.text}
        </p>
      ) : null}

      <section className="max-w-2xl space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">Public diversion key</h2>
        <p className="text-xs text-slate-400">
          Connect / IVR clients send this as <code className="text-slate-300">x-diversion-key</code>. Rotating
          invalidates the previous key immediately.
        </p>
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          disabled={rotateMut.isPending}
          onClick={() => rotateMut.mutate()}
        >
          {rotateMut.isPending ? "Rotating…" : "Rotate key"}
        </button>
        {plainKey ? (
          <pre className="overflow-x-auto rounded border border-amber-800/60 bg-amber-950/40 p-3 text-xs text-amber-100">
            {plainKey}
          </pre>
        ) : null}
      </section>

      <section className="max-w-2xl space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-white">
          {editingId ? "Edit workflow" : "Add workflow"}
        </h2>
        <label className="block text-xs text-slate-400">
          Name
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Intents (one phrase per line)
          <textarea
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            rows={4}
            value={form.intents}
            onChange={(e) => setForm((f) => ({ ...f, intents: e.target.value }))}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Portal URL
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            value={form.portalUrl}
            onChange={(e) => setForm((f) => ({ ...f, portalUrl: e.target.value }))}
            placeholder="https://…"
          />
        </label>
        <label className="block text-xs text-slate-400">
          SMS template (optional; use {"{portalUrl}"} / {"{workflowName}"})
          <textarea
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            rows={2}
            value={form.smsTemplate}
            onChange={(e) => setForm((f) => ({ ...f, smsTemplate: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          Enabled
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
            disabled={saveMut.isPending || !form.name.trim() || !form.portalUrl.trim() || !form.intents.trim()}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : editingId ? "Update" : "Create"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300"
              onClick={() => {
                setEditingId(undefined);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Workflows</h2>
        {workflowsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (workflowsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No workflows yet.</p>
        ) : (
          <ul className="space-y-2">
            {(workflowsQuery.data ?? []).map((wf) => (
              <li
                key={wf.workflowId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {wf.name}{" "}
                    <span className="text-xs font-normal text-slate-500">
                      {wf.enabled ? "enabled" : "disabled"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{wf.intents.join(" · ")}</p>
                  <p className="mt-1 break-all text-xs text-sky-400/80">{wf.portalUrl}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-sky-400 hover:underline"
                    onClick={() => {
                      setEditingId(wf.workflowId);
                      setForm({
                        name: wf.name,
                        description: wf.description ?? "",
                        intents: wf.intents.join("\n"),
                        portalUrl: wf.portalUrl,
                        smsTemplate: wf.smsTemplate ?? "",
                        enabled: wf.enabled,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-xs text-rose-400 hover:underline"
                    onClick={() => deleteMut.mutate(wf.workflowId)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Recent sessions</h2>
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (sessionsQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No diversion sessions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Session</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Match</th>
                  <th className="px-3 py-2 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {(sessionsQuery.data ?? []).map((s) => (
                  <tr key={s.sessionId} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-mono text-[10px]">{s.sessionId}</td>
                    <td className="px-3 py-2">{s.status}</td>
                    <td className="px-3 py-2">{s.matchedWorkflowName ?? "—"}</td>
                    <td className="px-3 py-2">{s.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
