"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CALL_ASSIST_PROMPT_KEYS, CALL_ASSIST_PROMPT_LABELS, CALL_ASSIST_QA_CHECKLIST, type CallAssistPromptKey } from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { canReviewCallAssistQa, canViewCallAssistQa } from "@/lib/call-assist/access";
import {
  getCallAssistQaDashboard,
  getCallAssistSessionQa,
  postCallAssistQaProposePrompt,
  postCallAssistQaReview,
  postCallAssistQaScore,
  searchCallAssistQa,
} from "@/lib/call-assist/call-assist-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 1000) / 10}%`;
}

export function CallAssistQaPage() {
  const { user } = useSession();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const { requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const allowed = canViewCallAssistQa(user?.role);
  const canReview = canReviewCallAssistQa(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed && ready);
  const [q, setQ] = useState("");
  const [falseTransfer, setFalseTransfer] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [notes, setNotes] = useState("");
  const [humanScore, setHumanScore] = useState("80");
  const [msg, setMsg] = useState<string | null>(null);
  const [proposePromptId, setProposePromptId] = useState("");

  const dash = useQuery({
    queryKey: ["call-assist-qa-dash", agencyId],
    queryFn: () => getCallAssistQaDashboard(requestAgencyId),
    enabled,
  });
  const search = useQuery({
    queryKey: ["call-assist-qa-search", agencyId, q, falseTransfer],
    queryFn: () =>
      searchCallAssistQa({ q, ...(falseTransfer ? { falseTransfer } : {}) }, requestAgencyId),
    enabled: enabled && q.trim().length >= 2,
  });
  const detail = useQuery({
    queryKey: ["call-assist-qa-session", sessionId, agencyId],
    queryFn: () => getCallAssistSessionQa(sessionId, requestAgencyId),
    enabled: enabled && sessionId.length > 4,
  });

  const score = useMutation({
    mutationFn: () => postCallAssistQaScore(sessionId, requestAgencyId),
    onSuccess: async () => {
      setMsg("AI score saved.");
      await qc.invalidateQueries({ queryKey: ["call-assist-qa-session", sessionId] });
      await qc.invalidateQueries({ queryKey: ["call-assist-qa-dash"] });
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Score failed"),
  });
  const review = useMutation({
    mutationFn: () =>
      postCallAssistQaReview(
        sessionId,
        { aggregateScore: Number(humanScore), notes, falseTransfer: falseTransfer === "true" },
        requestAgencyId,
      ),
    onSuccess: async () => {
      setMsg("Human review saved.");
      await qc.invalidateQueries({ queryKey: ["call-assist-qa-session", sessionId] });
      await qc.invalidateQueries({ queryKey: ["call-assist-qa-dash"] });
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Review failed"),
  });
  const propose = useMutation({
    mutationFn: () =>
      postCallAssistQaProposePrompt(
        sessionId,
        {
          promptId: proposePromptId ? (proposePromptId as CallAssistPromptKey) : undefined,
          findingSummary: notes.trim() || undefined,
        },
        requestAgencyId,
      ),
    onSuccess: async (res) => {
      setMsg(`Prompt proposal ${res.proposal.proposalId} queued for approval. It is not live.`);
      await qc.invalidateQueries({ queryKey: ["call-assist-qa-session", sessionId] });
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Propose failed"),
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">Call Assist QA is limited to supervisors, analysts, and auditors.</p>;
  }

  const d = dash.data?.dashboard;
  const reviewRow = detail.data?.review;
  const playback = detail.data?.playback ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <CallAssistChrome title="Call Assist QA" />
      <p className="max-w-2xl text-[12px] text-slate-500">
        AI transcript scoring, keyword search, utterance playback, false-transfer flags, and AI vs human comparison.
        Audio playback is unavailable while Call Assist recording stays off. QA findings never auto-publish; propose a
        prompt change for agency-admin approval.
      </p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Stat label="Reviews" value={d?.reviewCount ?? "—"} />
        <Stat label="Avg AI score" value={d?.averageAiScore != null ? d.averageAiScore.toFixed(1) : "—"} />
        <Stat label="Avg human score" value={d?.averageHumanScore != null ? d.averageHumanScore.toFixed(1) : "—"} />
        <Stat label="False-transfer rate" value={pct(d?.falseTransferRate)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label="AI reviews" value={d?.aiReviewCount ?? "—"} />
        <Stat label="Human reviews" value={d?.humanReviewCount ?? "—"} />
        <Stat label="Human takeovers" value={d?.humanTakeoverCount ?? "—"} />
      </div>
      {d?.keywordTop?.length ? (
        <div className="rounded-lg border border-slate-800 p-3">
          <h2 className="mb-2 text-[12px] font-semibold text-slate-200">Top keywords</h2>
          <div className="flex flex-wrap gap-1">
            {d.keywordTop.map((k) => (
              <span key={k.term} className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                {k.term} ({k.count})
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search.refetch();
        }}
      >
        <input
          className="min-w-[16rem] flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          placeholder="Keyword search in transcripts"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          value={falseTransfer}
          onChange={(e) => setFalseTransfer(e.target.value)}
        >
          <option value="">Any transfer flag</option>
          <option value="true">False transfer suspected</option>
          <option value="false">Not flagged</option>
        </select>
      </form>
      {search.data?.items?.length ? (
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {(search.data.items as Array<{ sessionId: string; state?: string; matches?: Array<{ text: string }> }>).map((row) => (
            <li key={row.sessionId} className="px-3 py-2">
              <button type="button" className="text-[12px] text-sky-400 hover:underline" onClick={() => setSessionId(row.sessionId)}>
                {row.sessionId}
              </button>
              <p className="text-[11px] text-slate-500">{row.matches?.[0]?.text ?? row.state}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="rounded-lg border border-slate-800 p-3">
        <h2 className="mb-2 text-[12px] font-semibold text-slate-200">Session review / playback</h2>
        <input
          className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          placeholder="Session ID"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value.trim())}
        />
        {sessionId ? (
          <Link className="mb-2 inline-block text-[12px] text-sky-400 hover:underline" href={to(`/call-assist/sessions/${sessionId}`)}>
            Open live session
          </Link>
        ) : null}
        {reviewRow ? (
          <p className="mb-2 text-[12px] text-slate-300">
            Source {reviewRow.source} · score {reviewRow.aggregateScore}
            {reviewRow.aiScore != null && reviewRow.humanScore != null
              ? ` · AI ${reviewRow.aiScore} vs human ${reviewRow.humanScore} (Δ ${reviewRow.scoreDelta ?? 0})`
              : null}
            {reviewRow.falseTransfer ? " · false transfer flagged" : ""}
          </p>
        ) : null}
        <ol className="mb-3 max-h-64 space-y-1 overflow-auto text-[12px]">
          {playback.map((u, i) => (
            <li key={`${u.sequence ?? i}-${u.speaker}`}>
              <span className="font-semibold text-slate-400">{u.speaker}:</span>{" "}
              <span className="text-slate-200">{u.text}</span>
            </li>
          ))}
        </ol>
        <ul className="mb-3 text-[11px] text-slate-500">
          {CALL_ASSIST_QA_CHECKLIST.map((c) => (
            <li key={c.id}>
              {c.label} (weight {c.weight})
            </li>
          ))}
        </ul>
        {canReview ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] text-slate-400">
              Human score
              <input
                className="mt-1 w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={humanScore}
                onChange={(e) => setHumanScore(e.target.value)}
              />
            </label>
            <textarea
              className="h-16 min-w-[16rem] flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
              placeholder="Coaching notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              type="button"
              className="rounded bg-sky-700 px-3 py-1.5 text-[12px] text-white"
              disabled={!sessionId || score.isPending}
              onClick={() => score.mutate()}
            >
              Run AI score
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-1.5 text-[12px] text-slate-200"
              disabled={!sessionId || review.isPending}
              onClick={() => review.mutate()}
            >
              Save human review
            </button>
            <label className="text-[11px] text-slate-400">
              Prompt
              <select
                className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={proposePromptId}
                onChange={(e) => setProposePromptId(e.target.value)}
              >
                <option value="">Auto from finding</option>
                {CALL_ASSIST_PROMPT_KEYS.map((id) => (
                  <option key={id} value={id}>
                    {CALL_ASSIST_PROMPT_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded border border-amber-500/40 px-3 py-1.5 text-[12px] text-amber-200"
              disabled={!sessionId || propose.isPending}
              onClick={() => propose.mutate()}
            >
              Propose prompt change
            </button>
          </div>
        ) : null}
        {msg ? <p className="mt-2 text-[12px] text-amber-300">{msg}</p> : null}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <p className="text-[20px] font-semibold text-slate-100">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
