"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type WatchCard = {
  id: string;
  external_key: string | null;
  status: string;
  agency: { name: string | null; department: string | null; city: string | null; state: string | null };
  title: string;
  primary_vertical: string | null;
  verticals: string[];
  signal_type: string | null;
  buying_stage: string | null;
  strength: string | null;
  fit: string;
  strategy: string | null;
  funding: {
    estimated_contract_value: number | null;
    project_budget: number | null;
    grant_amount: number | null;
    annual_support: number | null;
    funding_source: string | null;
  };
  solicitation_number: string | null;
  due_date: string | null;
  lifecycle_change: string | null;
  matched_capabilities: string[];
  next_action: string | null;
  facts: string[];
  inferences: string[];
  evidence: Array<{ url: string; sourceType?: string; source_quality?: string }>;
  activities: Array<{ at: string; changeType: string; summary: string }>;
  priority_score: number;
  priority_label: string | null;
  watched: boolean;
  assigned_user: string | null;
  crm_record_id: string | null;
  first_discovered_at: string;
  last_updated_at: string;
  evidence_count: number;
  watch: string | null;
};

const QUERY_KEY = ["watch-inbox-signals"];

function money(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

async function fetchWatchSignals(params: URLSearchParams): Promise<WatchCard[]> {
  const res = await fetch(`/api/watch/signals?${params.toString()}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load Watch Inbox (${res.status})`);
  const data = (await res.json()) as { signals?: WatchCard[] };
  return data.signals ?? [];
}

async function postWatchAction(id: string, action: string, body?: Record<string, unknown>) {
  const res = await fetch(`/api/watch/signals/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${action} failed (${res.status})`);
  }
  return res.json();
}

export function WatchInboxClient() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "monitoring" | "dismissed" | "qualified">("inbox");
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState("all");
  const [selected, setSelected] = useState<WatchCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (tab === "monitoring") p.set("watched", "true");
    if (tab === "dismissed") p.set("status", "dismissed");
    if (tab === "qualified") p.set("status", "pushed");
    if (vertical !== "all") p.set("vertical", vertical);
    if (search.trim()) p.set("q", search.trim());
    return p;
  }, [tab, vertical, search]);

  const listQ = useQuery({
    queryKey: [...QUERY_KEY, params.toString()],
    queryFn: () => fetchWatchSignals(params),
  });

  const signals = useMemo(() => {
    const rows = listQ.data ?? [];
    if (tab === "inbox") {
      return rows.filter((s) => s.status !== "dismissed" && s.status !== "pushed");
    }
    return rows;
  }, [listQ.data, tab]);

  const action = useMutation({
    mutationFn: async ({
      id,
      kind,
      body,
    }: {
      id: string;
      kind: "monitor" | "dismiss" | "qualify" | "assign";
      body?: Record<string, unknown>;
    }) => postWatchAction(id, kind, body),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: QUERY_KEY });
      setSelected(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Action failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Watch Inbox</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            ChatGPT Watch intelligence only. Signals never become CRM leads until a human qualifies
            them.
          </p>
        </div>
        <a
          href="/rc-admin/watch-ingest"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Admin ingest tester
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["inbox", "Watch Inbox"],
            ["monitoring", "Monitoring"],
            ["qualified", "Qualified"],
            ["dismissed", "Dismissed"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === id ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agency, initiative, solicitation…"
          className="min-w-[240px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        />
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
        >
          <option value="all">All verticals</option>
          <option value="psap">PSAP</option>
          <option value="campus">Campus</option>
          <option value="venue">Venue</option>
          <option value="transit">Transit</option>
          <option value="law_enforcement">Law Enforcement</option>
          <option value="competitor">Competitor</option>
        </select>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {listQ.isLoading ? <p className="text-sm text-slate-500">Loading Watch signals…</p> : null}
      {listQ.isError ? (
        <p className="text-sm text-rose-400">
          {listQ.error instanceof Error ? listQ.error.message : "Failed to load"}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {signals.map((s) => (
          <article
            key={s.id}
            className="rounded-lg border border-slate-800 bg-[#0b1220] p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-400">
                  {[s.agency.name, s.agency.state].filter(Boolean).join(", ")}
                </div>
                <h2 className="mt-1 text-base font-semibold text-white">{s.title}</h2>
              </div>
              <div className="text-right text-[10px] text-slate-500">
                <div>{s.priority_label ?? "—"}</div>
                <div className="tabular-nums">{s.priority_score}</div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase">
              {(s.verticals.length ? s.verticals : [s.primary_vertical]).filter(Boolean).map((v) => (
                <span key={v!} className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
                  {v}
                </span>
              ))}
              {s.signal_type ? (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">{s.signal_type}</span>
              ) : null}
              {s.buying_stage ? (
                <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-300">
                  {s.buying_stage}
                </span>
              ) : null}
              {s.watched ? (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">Monitoring</span>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>
                Strength: <span className="text-slate-200">{s.strength ?? "—"}</span>
              </div>
              <div>
                Fit: <span className="text-slate-200">{s.fit}</span>
              </div>
              <div>
                Strategy: <span className="text-slate-200">{s.strategy ?? "—"}</span>
              </div>
              <div>
                Due: <span className="text-slate-200">{s.due_date ?? "—"}</span>
              </div>
            </div>

            <div className="mt-3 space-y-1 text-xs">
              {money(s.funding.grant_amount) ? (
                <div className="text-slate-300">
                  Grant request <span className="font-semibold">{money(s.funding.grant_amount)}</span>
                </div>
              ) : null}
              {money(s.funding.project_budget) ? (
                <div className="text-slate-300">
                  Project budget <span className="font-semibold">{money(s.funding.project_budget)}</span>
                </div>
              ) : null}
              {money(s.funding.estimated_contract_value) ? (
                <div className="text-emerald-300">
                  Estimated contract{" "}
                  <span className="font-semibold">{money(s.funding.estimated_contract_value)}</span>
                </div>
              ) : null}
            </div>

            {s.next_action ? (
              <p className="mt-3 text-sm text-slate-300">
                <span className="text-[10px] font-semibold uppercase text-slate-500">Next action</span>
                <br />
                {s.next_action}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200"
                onClick={() => setSelected(s)}
              >
                View intelligence
              </button>
              {s.status !== "pushed" && s.status !== "dismissed" ? (
                <>
                  <button
                    type="button"
                    className="rounded-md bg-sky-700 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: s.id, kind: "qualify" })}
                  >
                    Qualify
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: s.id, kind: "monitor" })}
                  >
                    Monitor
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-rose-900/50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        id: s.id,
                        kind: "dismiss",
                        body: { reason: "Dismissed from Watch Inbox" },
                      })
                    }
                  >
                    Dismiss
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!listQ.isLoading && signals.length === 0 ? (
        <p className="text-sm text-slate-500">No Watch signals in this view.</p>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-[#0b1220] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{selected.title}</h3>
                <p className="text-xs text-slate-500">{selected.external_key}</p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-white"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>

            <section className="mt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                Verified facts
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {(selected.facts.length ? selected.facts : ["No facts submitted."]).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>

            <section className="mt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                NexCort analysis
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-300">
                {(selected.inferences.length ? selected.inferences : ["No inferences submitted."]).map(
                  (f) => (
                    <li key={f}>{f}</li>
                  ),
                )}
              </ul>
            </section>

            <section className="mt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Lifecycle
              </h4>
              <ol className="mt-2 space-y-2 border-l border-slate-700 pl-3">
                {(selected.activities ?? []).map((a) => (
                  <li key={`${a.at}-${a.changeType}`} className="text-sm text-slate-300">
                    <div className="text-[10px] text-slate-500">{a.at.slice(0, 10)}</div>
                    <div className="font-medium text-slate-200">{a.changeType.replace(/_/g, " ")}</div>
                    <div className="text-slate-400">{a.summary}</div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Evidence
              </h4>
              <ul className="mt-1 space-y-1 text-sm">
                {(selected.evidence ?? []).map((e) => (
                  <li key={e.url}>
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline"
                    >
                      {e.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
