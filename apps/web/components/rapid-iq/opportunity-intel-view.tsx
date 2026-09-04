"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RAPID_IQ_INTEL_OUTREACH_AUDIENCES,
  RAPID_IQ_INTEL_PROCUREMENT_STAGE_LABELS,
  effectiveIntelFit,
  effectiveIntelRecommendation,
  effectiveIntelStage,
  effectiveIntelWin,
  type RapidIqIntelOpportunity,
  type RapidIqIntelOutreachAudience,
  type RapidIqIntelStatus,
} from "rapid-cortex-shared";
import {
  INTEL_OPPORTUNITIES_QUERY_KEY,
  INTEL_WATCHES_QUERY_KEY,
  analyzeIntelOpportunity,
  generateIntelBidNoBid,
  generateIntelOutreach,
  generateIntelPursuitBrief,
  listIntelOpportunities,
  listIntelWatches,
  patchIntelOpportunity,
  patchIntelWatch,
  runIntelWatch,
  type IntelKpis,
} from "@/lib/rapid-iq/intel-api";

function usd(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function recClass(rec: string): string {
  if (rec === "PURSUE") return "text-emerald-300";
  if (rec === "PARTNER") return "text-sky-300";
  if (rec === "WATCH") return "text-amber-300";
  return "text-slate-500";
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-[110px] flex-col gap-1 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d1b35] px-4 py-3">
      <span className="text-2xl font-extrabold leading-none tracking-tight text-sky-300 tabular-nums">
        {value}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
    </div>
  );
}

const emptyKpis: IntelKpis = {
  newOpportunities: 0,
  highFit: 0,
  preRfpSignals: 0,
  dueWithin30Days: 0,
  estimatedPipeline: 0,
  agenciesWatched: 0,
};

export function OpportunityIntelView() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [market, setMarket] = useState("TRANSIT");
  const [recommendation, setRecommendation] = useState("");
  const [status, setStatus] = useState("");
  const [preRfp, setPreRfp] = useState("");
  const [minFit, setMinFit] = useState("7");
  const [agency, setAgency] = useState("");

  const listQ = useQuery({
    queryKey: [...INTEL_OPPORTUNITIES_QUERY_KEY, market, recommendation, status, preRfp, minFit, agency],
    queryFn: () =>
      listIntelOpportunities({
        market: market || undefined,
        recommendation: recommendation || undefined,
        status: status || undefined,
        preRfp: preRfp || undefined,
        minFit: minFit || undefined,
        agency: agency || undefined,
      }),
    staleTime: 30_000,
  });

  const watchesQ = useQuery({
    queryKey: INTEL_WATCHES_QUERY_KEY,
    queryFn: listIntelWatches,
    staleTime: 60_000,
  });

  const items = listQ.data?.items ?? [];
  const kpis = listQ.data?.kpis ?? emptyKpis;
  const selected = useMemo(
    () => items.find((r) => r.id === selectedId) ?? null,
    [items, selectedId],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-stretch gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-3">
        <Kpi value={String(kpis.newOpportunities)} label="New Opportunities" />
        <Kpi value={String(kpis.highFit)} label="High Fit" />
        <Kpi value={String(kpis.preRfpSignals)} label="Pre-RFP Signals" />
        <Kpi value={String(kpis.dueWithin30Days)} label="Due Within 30 Days" />
        <Kpi value={usd(kpis.estimatedPipeline)} label="Estimated Pipeline" />
        <Kpi value={String(kpis.agenciesWatched)} label="Agencies Watched" />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.06)] px-5 py-2">
        <select
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          className="rounded border border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-300"
        >
          <option value="">All markets</option>
          <option value="TRANSIT">Transit</option>
          <option value="PSAP">PSAP / 911</option>
          <option value="CAMPUS">Campus</option>
          <option value="VENUE">Venue</option>
          <option value="PARTNER">Partner</option>
        </select>
        <select
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value)}
          className="rounded border border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-300"
        >
          <option value="">All recommendations</option>
          <option value="PURSUE">Pursue</option>
          <option value="PARTNER">Partner</option>
          <option value="WATCH">Watch</option>
          <option value="IGNORE">Ignore</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-300"
        >
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="WATCHING">Watching</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="PURSUING">Pursuing</option>
          <option value="PASSED">Passed</option>
        </select>
        <select
          value={preRfp}
          onChange={(e) => setPreRfp(e.target.value)}
          className="rounded border border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-300"
        >
          <option value="">All stages</option>
          <option value="true">Pre-RFP only</option>
        </select>
        <select
          value={minFit}
          onChange={(e) => setMinFit(e.target.value)}
          className="rounded border border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-300"
        >
          <option value="">Any fit</option>
          <option value="7">Fit ≥ 7</option>
          <option value="5">Fit ≥ 5</option>
        </select>
        <input
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          placeholder="Filter agency…"
          className="rounded border border-slate-700 bg-[#080f1e] px-2 py-1 text-[11px] text-slate-200"
        />
        <span className="ml-auto text-[10px] text-slate-600">
          {watchesQ.data?.filter((w) => w.enabled).length ?? 0} transit watches enabled
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {listQ.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">Loading…</div>
          ) : listQ.isError ? (
            <div className="p-6 text-sm text-red-400">{(listQ.error as Error).message}</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">
              No opportunity intelligence yet. Watches run daily; use Run on a watch to collect now.
            </div>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-[#0a1628] text-[9px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">Agency</th>
                  <th className="px-3 py-2">Opportunity</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Posted</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Fit</th>
                  <th className="px-3 py-2">Win</th>
                  <th className="px-3 py-2">Rec</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer border-t border-[rgba(255,255,255,0.04)] hover:bg-[#102040] ${
                      selectedId === row.id ? "bg-[#102040]" : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-slate-200">{row.agency}</td>
                    <td className="max-w-[260px] px-3 py-2 text-slate-300">
                      <div className="truncate">{row.title}</div>
                      {row.preRfpSignal && (
                        <span className="text-[9px] font-bold uppercase text-amber-400">Pre-RFP</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{row.opportunityType}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {effectiveIntelStage(row)}{" "}
                      {RAPID_IQ_INTEL_PROCUREMENT_STAGE_LABELS[effectiveIntelStage(row)] ?? ""}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{row.postedDate?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{row.dueDate?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{usd(row.estimatedValue)}</td>
                    <td className="px-3 py-2 font-bold text-sky-300">{effectiveIntelFit(row).toFixed(1)}</td>
                    <td className="px-3 py-2 font-bold text-amber-300">{effectiveIntelWin(row).toFixed(1)}</td>
                    <td className={`px-3 py-2 font-semibold ${recClass(effectiveIntelRecommendation(row))}`}>
                      {effectiveIntelRecommendation(row)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {selected && (
          <IntelDetail
            opportunity={selected}
            onClose={() => setSelectedId(null)}
            onUpdated={() => {
              void qc.invalidateQueries({ queryKey: INTEL_OPPORTUNITIES_QUERY_KEY });
              void qc.invalidateQueries({ queryKey: INTEL_WATCHES_QUERY_KEY });
            }}
          />
        )}
      </div>
      <IntelWatchesStrip />
    </div>
  );
}

function IntelDetail({
  opportunity,
  onClose,
  onUpdated,
}: {
  opportunity: RapidIqIntelOpportunity;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [audience, setAudience] = useState<RapidIqIntelOutreachAudience>("CIO");
  const [generated, setGenerated] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(status: RapidIqIntelStatus) {
    setBusy(status);
    try {
      await patchIntelOpportunity(opportunity.id, { status });
      onUpdated();
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="w-[420px] shrink-0 overflow-auto border-l border-[rgba(255,255,255,0.06)] bg-[#080f1e] p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">{opportunity.agency}</div>
          <h2 className="text-sm font-bold text-slate-100">{opportunity.title}</h2>
        </div>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200">
          ✕
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-slate-400">
        <dt>Solicitation</dt>
        <dd className="text-slate-200">{opportunity.solicitationNumber ?? "—"}</dd>
        <dt>Posted</dt>
        <dd>{opportunity.postedDate?.slice(0, 10) ?? "—"}</dd>
        <dt>Due</dt>
        <dd>{opportunity.dueDate?.slice(0, 10) ?? "—"}</dd>
        <dt>Value</dt>
        <dd>{usd(opportunity.estimatedValue)}</dd>
        <dt>Department</dt>
        <dd>{opportunity.issuingDepartment ?? "—"}</dd>
        <dt>Contact</dt>
        <dd>
          {opportunity.contact?.name ?? "—"}
          {opportunity.contact?.email ? ` · ${opportunity.contact.email}` : ""}
        </dd>
        <dt>Fit</dt>
        <dd className="font-bold text-sky-300">{effectiveIntelFit(opportunity).toFixed(1)}</dd>
        <dt>Win</dt>
        <dd className="font-bold text-amber-300">{effectiveIntelWin(opportunity).toFixed(1)}</dd>
        <dt>Stage</dt>
        <dd>
          {effectiveIntelStage(opportunity)}{" "}
          {RAPID_IQ_INTEL_PROCUREMENT_STAGE_LABELS[effectiveIntelStage(opportunity)]}
        </dd>
        <dt>Recommendation</dt>
        <dd className={recClass(effectiveIntelRecommendation(opportunity))}>
          {effectiveIntelRecommendation(opportunity)}
        </dd>
        <dt>Confidence</dt>
        <dd>{Math.round(opportunity.confidence * 100)}%</dd>
      </dl>

      <Section title="Why Rapid Cortex Fits">{opportunity.reason}</Section>
      <Section title="Recommended Next Action">{opportunity.recommendedAction}</Section>
      {opportunity.competitiveNotes && (
        <Section title="Competitive Notes">{opportunity.competitiveNotes}</Section>
      )}
      {opportunity.partnerStrategy && (
        <Section title="Partner Strategy">{opportunity.partnerStrategy}</Section>
      )}
      {opportunity.incumbentTechnology && opportunity.incumbentTechnology.length > 0 && (
        <Section title="Known / detected technology">
          {opportunity.incumbentTechnology.join(", ")}
        </Section>
      )}
      <Section title="Categories">{opportunity.categories.join(", ") || "—"}</Section>
      <Section title="Rapid Cortex products">{opportunity.rapidCortexProducts.join(", ")}</Section>
      <a
        href={opportunity.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-[11px] text-sky-400 hover:underline"
      >
        Original source
      </a>
      <p className="mt-3 text-[10px] text-slate-600">
        AI assistance only — not an automatic procurement decision. Model {opportunity.modelUsed ?? "n/a"}.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Action label="Add to Pipeline" busy={busy} onClick={() => setStatus("QUALIFIED")} />
        <Action label="Mark Pursuing" busy={busy} onClick={() => setStatus("PURSUING")} />
        <Action
          label="Watch Agency"
          busy={busy}
          onClick={async () => {
            if (!opportunity.watchId) return;
            setBusy("watch");
            try {
              await patchIntelWatch(opportunity.watchId, { enabled: true });
              onUpdated();
            } finally {
              setBusy(null);
            }
          }}
        />
        <Action label="Pass" busy={busy} onClick={() => setStatus("PASSED")} />
        <Action
          label="Re-analyze"
          busy={busy}
          onClick={async () => {
            setBusy("analyze");
            try {
              await analyzeIntelOpportunity(opportunity.id);
              onUpdated();
            } finally {
              setBusy(null);
            }
          }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as RapidIqIntelOutreachAudience)}
          className="rounded border border-slate-700 bg-transparent px-2 py-1 text-[11px] text-slate-300"
        >
          {RAPID_IQ_INTEL_OUTREACH_AUDIENCES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <Action
          label="Generate Outreach"
          busy={busy}
          onClick={async () => {
            setBusy("outreach");
            try {
              const out = await generateIntelOutreach(opportunity.id, audience);
              setGenerated(out.text);
            } finally {
              setBusy(null);
            }
          }}
        />
        <Action
          label="Generate Pursuit Brief"
          busy={busy}
          onClick={async () => {
            setBusy("brief");
            try {
              const out = await generateIntelPursuitBrief(opportunity.id);
              setGenerated(
                Object.entries(out.brief)
                  .map(([k, v]) => `${k}\n${v}`)
                  .join("\n\n"),
              );
              onUpdated();
            } finally {
              setBusy(null);
            }
          }}
        />
        <Action
          label="Generate Bid / No-Bid"
          busy={busy}
          onClick={async () => {
            setBusy("bid");
            try {
              const out = await generateIntelBidNoBid(opportunity.id);
              setGenerated(`${out.analysis.recommendation}\n\n${out.analysis.rationale}`);
            } finally {
              setBusy(null);
            }
          }}
        />
      </div>
      {generated && (
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-800 bg-[#050c1a] p-3 text-[11px] text-slate-300">
          {generated}
        </pre>
      )}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}

function Action({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: string | null;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={Boolean(busy)}
      onClick={() => void onClick()}
      className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function IntelWatchesStrip() {
  const qc = useQueryClient();
  const watchesQ = useQuery({
    queryKey: INTEL_WATCHES_QUERY_KEY,
    queryFn: listIntelWatches,
  });
  const runM = useMutation({
    mutationFn: runIntelWatch,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: INTEL_WATCHES_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: INTEL_OPPORTUNITIES_QUERY_KEY });
    },
  });
  const watches = watchesQ.data ?? [];
  if (watches.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 border-t border-[rgba(255,255,255,0.04)] px-5 py-2">
      {watches.slice(0, 25).map((w) => (
        <button
          key={w.id}
          type="button"
          title={`Run ${w.agency}`}
          onClick={() => runM.mutate(w.id)}
          className={`rounded-full px-2 py-0.5 text-[9px] ${
            w.enabled ? "border border-slate-700 text-slate-400 hover:text-slate-200" : "text-slate-700"
          }`}
        >
          {w.name}
        </button>
      ))}
    </div>
  );
}
