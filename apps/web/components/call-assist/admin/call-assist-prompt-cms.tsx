"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CALL_ASSIST_PROMPT_KEYS,
  CALL_ASSIST_PROMPT_LABELS,
  type CallAssistPromptKey,
  type CallAssistPromptProposal,
  type CallAssistPromptRecord,
  type PromptDiffLine,
} from "rapid-cortex-shared";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import {
  getCallAssistPromptProposals,
  getCallAssistPrompts,
  postCallAssistPrompt,
  postCallAssistPromptProposalDecision,
  postCallAssistPromptRollback,
} from "@/lib/call-assist/call-assist-api";

export function CallAssistPromptCms() {
  const qc = useQueryClient();
  const { requestAgencyId, agencyId } = useCallAssistConfig();
  const [promptId, setPromptId] = useState<CallAssistPromptKey>("opening");
  const [draft, setDraft] = useState("");
  const [diff, setDiff] = useState<PromptDiffLine[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const query = useQuery({
    queryKey: ["call-assist-prompts", agencyId],
    queryFn: () => getCallAssistPrompts(requestAgencyId),
  });
  const proposalsQuery = useQuery({
    queryKey: ["call-assist-prompt-proposals", agencyId],
    queryFn: () => getCallAssistPromptProposals(requestAgencyId),
  });

  const records = (query.data?.items ?? []) as CallAssistPromptRecord[];
  const current = records.find((r) => r.promptId === promptId);
  const proposals = (proposalsQuery.data?.items ?? []) as CallAssistPromptProposal[];
  const pending = proposals.filter((p) => p.status === "pending_approval" || p.status === "draft");

  useEffect(() => {
    setDraft(current?.body ?? "");
    setDiff(null);
  }, [current?.promptId, current?.version, current?.body]);

  const save = useMutation({
    mutationFn: () => postCallAssistPrompt({ promptId, body: draft }, requestAgencyId),
    onSuccess: async (res) => {
      setDiff(res.diff);
      setMsg(`Saved ${promptId} as version ${res.record.version} by ${res.record.updatedBy}.`);
      await qc.invalidateQueries({ queryKey: ["call-assist-prompts"] });
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Save failed"),
  });
  const rollback = useMutation({
    mutationFn: (version: number) => postCallAssistPromptRollback({ promptId, version }, requestAgencyId),
    onSuccess: async (res) => {
      setMsg(`Rolled back ${promptId} to version ${res.record.version}.`);
      await qc.invalidateQueries({ queryKey: ["call-assist-prompts"] });
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Rollback failed"),
  });
  const decide = useMutation({
    mutationFn: (opts: { proposalId: string; decision: "approve" | "reject" | "withdraw" }) =>
      postCallAssistPromptProposalDecision(
        opts.proposalId,
        { decision: opts.decision, reviewNotes: reviewNotes.trim() || undefined },
        requestAgencyId,
      ),
    onSuccess: async (res, vars) => {
      setMsg(`${vars.decision === "approve" ? "Published" : vars.decision} ${res.proposal.promptId}.`);
      setReviewNotes("");
      await qc.invalidateQueries({ queryKey: ["call-assist-prompt-proposals"] });
      await qc.invalidateQueries({ queryKey: ["call-assist-prompts"] });
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Decision failed"),
  });

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 p-4">
      <h2 className="text-sm font-semibold text-white">Prompt CMS</h2>
      <p className="text-[12px] text-slate-500">
        Change-control for spoken Call Assist prompts and the dispatch AI system prompt. QA findings never go live
        until an agency administrator approves them here. Direct saves still version, diff, and support rollback.
      </p>
      {pending.length ? (
        <div className="space-y-2 rounded border border-amber-500/20 bg-amber-500/5 p-3">
          <h3 className="text-[12px] font-semibold text-amber-200">QA prompt approval queue ({pending.length})</h3>
          <textarea
            className="h-12 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[12px]"
            placeholder="Review notes (optional, attached to approve/reject)"
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.proposalId} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                <p className="text-[12px] text-slate-200">
                  {CALL_ASSIST_PROMPT_LABELS[p.promptId]} · {p.status.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{p.findingSummary}</p>
                <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap text-[11px] text-slate-300">
                  {p.proposedBody}
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded bg-sky-700 px-2 py-1 text-[11px] text-white"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ proposalId: p.proposalId, decision: "approve" })}
                  >
                    Approve & publish
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ proposalId: p.proposalId, decision: "reject" })}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-400"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ proposalId: p.proposalId, decision: "withdraw" })}
                  >
                    Withdraw
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">No pending QA prompt proposals.</p>
      )}
      <select
        className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
        value={promptId}
        onChange={(e) => setPromptId(e.target.value as CallAssistPromptKey)}
      >
        {CALL_ASSIST_PROMPT_KEYS.map((id) => (
          <option key={id} value={id}>
            {CALL_ASSIST_PROMPT_LABELS[id]}
          </option>
        ))}
      </select>
      {current ? (
        <p className="text-[11px] text-slate-500">
          v{current.version} · {current.updatedBy} · {new Date(current.updatedAt).toLocaleString()}
        </p>
      ) : null}
      <textarea
        className="h-48 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[12px] text-slate-100"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-[12px] text-white"
          disabled={save.isPending || !draft.trim()}
          onClick={() => save.mutate()}
        >
          Save new version
        </button>
      </div>
      {diff ? (
        <pre className="max-h-40 overflow-auto rounded border border-slate-800 bg-slate-950 p-2 text-[11px] leading-5">
          {diff.map((line, i) => (
            <div
              key={`${i}-${line.type}`}
              className={
                line.type === "add" ? "text-emerald-300" : line.type === "del" ? "text-rose-300" : "text-slate-500"
              }
            >
              {line.type === "add" ? "+" : line.type === "del" ? "-" : " "} {line.text}
            </div>
          ))}
        </pre>
      ) : null}
      {current?.previous?.length ? (
        <div>
          <h3 className="mb-1 text-[12px] font-semibold text-slate-300">History</h3>
          <ul className="space-y-1 text-[11px] text-slate-400">
            {current.previous.map((p) => (
              <li key={p.version} className="flex flex-wrap items-center gap-2">
                <span>
                  v{p.version} · {p.updatedBy} · {new Date(p.updatedAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="rounded border border-slate-700 px-2 py-0.5 text-slate-200"
                  disabled={rollback.isPending}
                  onClick={() => rollback.mutate(p.version)}
                >
                  Rollback
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {msg ? <p className="text-[12px] text-amber-300">{msg}</p> : null}
    </section>
  );
}
