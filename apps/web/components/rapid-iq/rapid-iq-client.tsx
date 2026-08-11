"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { IntentStage, RapidIqVertical } from "@/lib/rapid-iq/types";
import {
  computeStats,
  getOpportunityDetail,
  listOpportunities,
  OPPORTUNITIES_QUERY_KEY,
} from "@/lib/rapid-iq/api";
import { isKnownCompetitor } from "@/lib/rapid-iq/competitor-registry";
import { ConvertToLeadModal } from "./convert-to-lead-modal";
import { OpportunityDetailPanel } from "./opportunity-detail-panel";
import { OpportunityFeed } from "./opportunity-feed";
import { RapidIqRefreshButton } from "./rapid-iq-refresh-button";
import { RapidIqStatsBar } from "./rapid-iq-stats-bar";
import { VerticalTabs, type FeedTab } from "./vertical-tabs";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

export function RapidIqClient() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>("911");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<IntentStage | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [convertOpp, setConvertOpp] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);

  const listVertical: RapidIqVertical | undefined =
    feedTab === "competitor" ? undefined : feedTab;

  const listQ = useQuery({
    queryKey: [...OPPORTUNITIES_QUERY_KEY, feedTab, stateFilter, stageFilter, search],
    queryFn: () =>
      listOpportunities({
        vertical: listVertical,
        state: stateFilter === "all" ? undefined : stateFilter,
        intentStage: stageFilter === "all" ? undefined : stageFilter,
        search: search.trim() || undefined,
      }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const demo = listQ.data?.demo ?? false;
  const rawItems = listQ.data?.items ?? [];
  const opportunities = useMemo(() => {
    if (feedTab !== "competitor") return rawItems;
    return rawItems.filter((o) => isKnownCompetitor(o.incumbentVendor));
  }, [feedTab, rawItems]);

  const competitorCountQ = useQuery({
    queryKey: [...OPPORTUNITIES_QUERY_KEY, "competitor-count"],
    queryFn: () => listOpportunities({}),
    staleTime: 60_000,
  });
  const competitorCount = useMemo(
    () => (competitorCountQ.data?.items ?? []).filter((o) => isKnownCompetitor(o.incumbentVendor)).length,
    [competitorCountQ.data],
  );

  const stats = useMemo(() => computeStats(opportunities), [opportunities]);

  const selectedOpp = useMemo(
    () => opportunities.find((o) => o.opportunityId === selectedId) ?? null,
    [opportunities, selectedId],
  );

  const detailQ = useQuery({
    queryKey: ["rapid-iq-detail", selectedId, demo],
    queryFn: () => getOpportunityDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const detail = detailQ.data;
  const panelOpp = detail?.opportunity ?? selectedOpp;

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#050c1a]">
      <RapidIqStatsBar
        stats={stats}
        lastUpdated={panelOpp?.lastRefreshedAt ?? opportunities[0]?.lastRefreshedAt}
        demo={demo}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-2.5">
        <VerticalTabs
          value={feedTab}
          competitorCount={competitorCount}
          onChange={(v) => {
            setFeedTab(v);
            setSelectedId(null);
          }}
        />

        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-full border border-[rgba(255,255,255,0.06)] bg-transparent px-3 py-1.5 text-[11px] text-slate-600 outline-none focus:border-sky-500"
        >
          <option value="all">All States</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as IntentStage | "all")}
          className="rounded-full border border-[rgba(255,255,255,0.06)] bg-transparent px-3 py-1.5 text-[11px] text-slate-600 outline-none focus:border-sky-500"
        >
          <option value="all">All Stages</option>
          <option value="awareness">Awareness</option>
          <option value="evaluation">Evaluation</option>
          <option value="active_rfp">Active RFP</option>
          <option value="award_imminent">Award Imminent</option>
        </select>

        <div className="relative min-w-[200px] max-w-[280px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#334155]">
            🔍
          </span>
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agencies, headlines, tags…"
            className="w-full rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080f1e] py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-[#334155] outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20"
          />
        </div>

        <div className="ml-auto">
          <RapidIqRefreshButton demo={demo} />
        </div>
      </div>

      {convertSuccess && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-300">
          Lead created: {convertSuccess}
          {demo && " (demo)"}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-full max-w-[420px] shrink-0 border-r border-[rgba(255,255,255,0.06)]">
          {listQ.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">Loading…</div>
          ) : listQ.isError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-red-400">{(listQ.error as Error).message}</p>
              <button
                type="button"
                onClick={() => void listQ.refetch()}
                className="rounded-lg border border-sky-500/30 bg-sky-500/8 px-5 py-2 text-xs font-bold text-sky-300"
              >
                ↻ Try again
              </button>
            </div>
          ) : (
            <OpportunityFeed
              opportunities={opportunities}
              selectedId={selectedId}
              onSelect={setSelectedId}
              vertical={feedTab}
              demo={demo}
            />
          )}
        </div>

        {panelOpp ? (
          <OpportunityDetailPanel
            opportunity={panelOpp}
            signals={detail?.signals ?? []}
            contacts={detail?.contacts ?? []}
            sources={detail?.sources ?? []}
            mentioned={detail?.mentioned ?? []}
            demo={detail?.demo ?? demo}
            onClose={() => setSelectedId(null)}
            onConvert={() => setConvertOpp(panelOpp.opportunityId)}
          />
        ) : selectedId && detailQ.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
            Loading detail…
          </div>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center lg:flex">
            <div className="text-5xl opacity-[0.05]">⚡</div>
            <div className="text-sm font-semibold text-slate-400">Select an opportunity</div>
            <div className="max-w-[260px] text-xs text-slate-600">
              Review AI summaries, source documents, and contact intelligence for each signal.
            </div>
          </div>
        )}
      </div>

      {convertOpp && panelOpp && convertOpp === panelOpp.opportunityId && (
        <ConvertToLeadModal
          opportunity={panelOpp}
          demo={demo}
          onClose={() => setConvertOpp(null)}
          onSuccess={(leadId) => {
            setConvertSuccess(leadId);
            setConvertOpp(null);
          }}
        />
      )}
    </div>
  );
}
