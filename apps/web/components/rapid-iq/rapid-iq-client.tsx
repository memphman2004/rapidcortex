"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RapidIqOpportunity, IntentStage, RapidIqVertical } from "@/lib/rapid-iq/types";
import type { RapidIqPipelineSignal, RapidIqProcurementStageFilterId } from "rapid-cortex-shared";
import { matchesProcurementStageFilter, resolveProcurementStage } from "rapid-cortex-shared";
import {
  computeStats,
  getOpportunityDetail,
  listOpportunities,
  OPPORTUNITIES_QUERY_KEY,
  updateOpportunity,
} from "@/lib/rapid-iq/api";
import {
  countQueuedUnworked,
  inboxPipelineSignals,
  isInboxOpportunity,
  opportunityFeedTab,
  queuedPipelineSignals,
} from "@/lib/rapid-iq/pipeline-feed";
import {
  enqueuePipelineFromOpportunity,
  getPipelineSignals,
  patchPipelineSignalStatus,
  PIPELINE_AGENCIES_QUERY_KEY,
  PIPELINE_SIGNALS_QUERY_KEY,
  pipelineOpportunityIdSet as pipelineOppIds,
} from "@/lib/rapid-iq/pipeline-api";
import { fetchRfpCounts, RFP_COUNTS_QUERY_KEY } from "@/lib/rapid-iq/intel-api";
import { isRapidIqIntelUiEnabled, isRapidIqPipelineUiEnabled } from "@/lib/runtime-flags";
import { IncomingSignalDetail } from "./incoming-signal-detail";
import { OpportunityDetailPanel } from "./opportunity-detail-panel";
import { OpportunityFeed } from "./opportunity-feed";
import { PipelineView } from "./pipeline/pipeline-signals-client";
import { RapidIqRefreshButton } from "./rapid-iq-refresh-button";
import { RapidIqStatsBar } from "./rapid-iq-stats-bar";
import { RapidIqAccountsView } from "./accounts-view";
import { RapidIqResearchPanel } from "./research-panel";
import { ManualSignalForm } from "./manual-signal-form";
import { OpportunityIntelView } from "./opportunity-intel-view";
import { FEED_TAB_LABELS, VerticalTabs, type FeedTab } from "./vertical-tabs";
import { ProcurementStageTabs } from "./procurement-stage-tabs";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

export function RapidIqClient() {
  const searchRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const pipelineEnabled = isRapidIqPipelineUiEnabled();
  const intelEnabled = pipelineEnabled && isRapidIqIntelUiEnabled();
  const [feedTab, setFeedTab] = useState<FeedTab>("911");
  const [procurementStageFilter, setProcurementStageFilter] =
    useState<RapidIqProcurementStageFilterId>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<IntentStage | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [addSignalOpen, setAddSignalOpen] = useState(false);
  const [taxonomyFilter, setTaxonomyFilter] = useState<string | null>(null);
  const [addingPipelineId, setAddingPipelineId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [pipelineToast, setPipelineToast] = useState<string | null>(null);
  const [pipelineActionError, setPipelineActionError] = useState<string | null>(null);

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

  const pipelineQ = useQuery({
    queryKey: PIPELINE_SIGNALS_QUERY_KEY,
    queryFn: () => getPipelineSignals(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: pipelineEnabled,
    retry: 1,
  });

  const demo = listQ.data?.demo ?? false;
  const pipelineItems = useMemo(() => pipelineQ.data ?? [], [pipelineQ.data]);
  const inPipelineIds = useMemo(() => pipelineOppIds(pipelineItems), [pipelineItems]);

  const rawItems = useMemo(() => listQ.data?.items ?? [], [listQ.data?.items]);
  const opportunities = useMemo(() => {
    return rawItems.filter((o) => {
      if (!isInboxOpportunity(o)) return false;
      if (opportunityFeedTab(o) !== feedTab) return false;
      if (inPipelineIds.has(o.opportunityId)) return false;
      return true;
    });
  }, [feedTab, rawItems, inPipelineIds]);

  const incomingSignals = useMemo(
    () =>
      inboxPipelineSignals(pipelineItems, feedTab).filter((s) => {
        if (!matchesProcurementStageFilter(resolveProcurementStage(s), procurementStageFilter)) {
          return false;
        }
        if (taxonomyFilter && !(s.taxonomyTags ?? []).includes(taxonomyFilter)) return false;
        return true;
      }),
    [pipelineItems, feedTab, procurementStageFilter, taxonomyFilter],
  );
  const taxonomyChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of inboxPipelineSignals(pipelineItems, feedTab)) {
      for (const tag of s.taxonomyTags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, count]) => ({ id, count }));
  }, [pipelineItems, feedTab]);
  const queuedSignals = useMemo(
    () => queuedPipelineSignals(pipelineItems, feedTab),
    [pipelineItems, feedTab],
  );
  const pipelineCount = useMemo(
    () => countQueuedUnworked(pipelineItems, feedTab),
    [pipelineItems, feedTab],
  );

  const competitorCountQ = useQuery({
    queryKey: [...OPPORTUNITIES_QUERY_KEY, "competitor-count"],
    queryFn: () => listOpportunities({}),
    staleTime: 60_000,
  });
  const competitorCount = useMemo(() => {
    const oppCount = (competitorCountQ.data?.items ?? []).filter(
      (o) =>
        isInboxOpportunity(o) &&
        opportunityFeedTab(o) === "competitor" &&
        !inPipelineIds.has(o.opportunityId),
    ).length;
    return oppCount + inboxPipelineSignals(pipelineItems, "competitor").length;
  }, [competitorCountQ.data, inPipelineIds, pipelineItems]);

  const rfpCountsQ = useQuery({
    queryKey: RFP_COUNTS_QUERY_KEY,
    queryFn: fetchRfpCounts,
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: pipelineEnabled && !demo,
    retry: 1,
  });

  const stats = useMemo(() => {
    const base = computeStats(opportunities);
    if (demo) return base;
    const open = rfpCountsQ.data?.snapshot?.total.open;
    if (typeof open === "number") return { ...base, rfps: open };
    return base;
  }, [opportunities, demo, rfpCountsQ.data]);

  const selectedOpp = useMemo(
    () => opportunities.find((o) => o.opportunityId === selectedId) ?? null,
    [opportunities, selectedId],
  );
  const selectedIncoming = useMemo(
    () => incomingSignals.find((s) => s.signalId === selectedSignalId) ?? null,
    [incomingSignals, selectedSignalId],
  );

  const detailQ = useQuery({
    queryKey: ["rapid-iq-detail", selectedId, demo],
    queryFn: () => getOpportunityDetail(selectedId!),
    enabled: Boolean(selectedId) && !showPipeline,
  });

  const detail = detailQ.data;
  const panelOpp = detail?.opportunity ?? selectedOpp;

  function selectOpportunity(id: string) {
    setSelectedId(id);
    setSelectedSignalId(null);
  }

  function selectIncoming(id: string) {
    setSelectedSignalId(id);
    setSelectedId(null);
  }

  async function handleAddToPipeline(opportunity: RapidIqOpportunity) {
    if (inPipelineIds.has(opportunity.opportunityId) || addingPipelineId) return;
    setAddingPipelineId(opportunity.opportunityId);
    setPipelineActionError(null);
    const vertical = opportunityFeedTab(opportunity);
    try {
      if (demo) {
        const queued: RapidIqPipelineSignal = {
          signalId: `demo-pipe-${opportunity.opportunityId}`,
          sourceId: "rapid-iq",
          sourceUrl: `https://app.rapidcortex.us/rc-admin/rapid-iq#${opportunity.opportunityId}`,
          rawTitle: opportunity.aiHeadline || opportunity.agencyName,
          rawSnippet: opportunity.aiSummary,
          contentHash: `demo-${opportunity.opportunityId}`,
          signalDate: new Date().toISOString().slice(0, 10),
          ingestedAt: new Date().toISOString(),
          agencyName: opportunity.agencyName,
          jurisdiction: opportunity.city,
          state: opportunity.state,
          agencyType: opportunity.agencyType,
          vendorNamed: opportunity.incumbentVendor ?? undefined,
          dollarAmount: opportunity.estimatedDollarValue ?? undefined,
          summary: opportunity.aiSummary,
          fitScore: opportunity.fitScore,
          fitLabel:
            opportunity.fitScore >= 80 ? "high" : opportunity.fitScore >= 60 ? "medium" : "low",
          status: "new",
          opportunityId: opportunity.opportunityId,
          vertical,
        } as RapidIqPipelineSignal;
        qc.setQueryData<RapidIqPipelineSignal[]>(PIPELINE_SIGNALS_QUERY_KEY, (prev) => [
          queued,
          ...(prev ?? []),
        ]);
      } else {
        await enqueuePipelineFromOpportunity({
          opportunityId: opportunity.opportunityId,
          agencyName: opportunity.agencyName,
          headline: opportunity.aiHeadline,
          summary: opportunity.aiSummary,
          state: opportunity.state,
          city: opportunity.city,
          agencyType: opportunity.agencyType,
          vendorNamed: opportunity.incumbentVendor ?? undefined,
          fitScore: opportunity.fitScore,
          estimatedDollarValue: opportunity.estimatedDollarValue ?? undefined,
        });
        await qc.invalidateQueries({ queryKey: PIPELINE_SIGNALS_QUERY_KEY });
      }
      setPipelineToast(`Sent to Pipeline — ${opportunity.agencyName}`);
      setSelectedId(null);
    } catch (err) {
      setPipelineActionError(err instanceof Error ? err.message : "Could not add to pipeline");
    } finally {
      setAddingPipelineId(null);
    }
  }

  async function handleDismissOpportunity(opportunity: RapidIqOpportunity) {
    setDismissingId(opportunity.opportunityId);
    setPipelineActionError(null);
    try {
      await updateOpportunity(opportunity.opportunityId, { status: "dismissed" }, demo);
      await qc.invalidateQueries({ queryKey: OPPORTUNITIES_QUERY_KEY });
      if (selectedId === opportunity.opportunityId) setSelectedId(null);
      setPipelineToast(`Dismissed — ${opportunity.agencyName}`);
    } catch (err) {
      setPipelineActionError(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setDismissingId(null);
    }
  }

  async function handleAddSignalToPipeline(signal: RapidIqPipelineSignal) {
    setAddingPipelineId(signal.signalId);
    setPipelineActionError(null);
    try {
      if (demo) {
        qc.setQueryData<RapidIqPipelineSignal[]>(PIPELINE_SIGNALS_QUERY_KEY, (prev) =>
          (prev ?? []).map((s) => (s.signalId === signal.signalId ? { ...s, status: "reviewed" } : s)),
        );
      } else {
        await patchPipelineSignalStatus(signal.signalId, "reviewed");
        await qc.invalidateQueries({ queryKey: PIPELINE_SIGNALS_QUERY_KEY });
      }
      setPipelineToast(`Sent to Pipeline — ${signal.agencyName ?? signal.rawTitle}`);
      setSelectedSignalId(null);
    } catch (err) {
      setPipelineActionError(err instanceof Error ? err.message : "Could not add to pipeline");
    } finally {
      setAddingPipelineId(null);
    }
  }

  async function handleDismissSignal(signal: RapidIqPipelineSignal) {
    setDismissingId(signal.signalId);
    setPipelineActionError(null);
    try {
      if (demo) {
        qc.setQueryData<RapidIqPipelineSignal[]>(PIPELINE_SIGNALS_QUERY_KEY, (prev) =>
          (prev ?? []).map((s) => (s.signalId === signal.signalId ? { ...s, status: "dismissed" } : s)),
        );
      } else {
        await patchPipelineSignalStatus(signal.signalId, "dismissed");
        await qc.invalidateQueries({ queryKey: PIPELINE_SIGNALS_QUERY_KEY });
      }
      if (selectedSignalId === signal.signalId) setSelectedSignalId(null);
      setPipelineToast(`Dismissed — ${signal.agencyName ?? signal.rawTitle}`);
    } catch (err) {
      setPipelineActionError(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#050c1a]">
      <RapidIqStatsBar
        stats={stats}
        lastUpdated={
          rfpCountsQ.data?.snapshot?.updatedAt ??
          panelOpp?.lastRefreshedAt ??
          opportunities[0]?.lastRefreshedAt
        }
        demo={demo}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.06)] bg-[#0a1628] px-5 py-2.5">
        <VerticalTabs
          value={feedTab}
          competitorCount={competitorCount}
          onChange={(v) => {
            setFeedTab(v);
            setSelectedId(null);
            setSelectedSignalId(null);
          }}
        />
        <ProcurementStageTabs
          value={procurementStageFilter}
          onChange={(v) => {
            setProcurementStageFilter(v);
            setSelectedSignalId(null);
          }}
        />
        {taxonomyChips.length > 0 && (
          <div className="flex max-w-[420px] flex-wrap gap-1">
            {taxonomyChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setTaxonomyFilter((cur) => (cur === chip.id ? null : chip.id))}
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  taxonomyFilter === chip.id
                    ? "bg-sky-600 text-white"
                    : "border border-slate-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {chip.id.replace(/^(technology|procurement|stage):/, "")} {chip.count}
              </button>
            ))}
          </div>
        )}

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
          <RapidIqRefreshButton
            demo={demo}
            pipelineEnabled={pipelineEnabled}
            pipelineCount={pipelineCount}
            showPipeline={showPipeline}
            onTogglePipeline={() => {
              setShowPipeline((p) => !p);
              setShowAccounts(false);
              setShowIntel(false);
            }}
            showAccounts={showAccounts}
            onToggleAccounts={() => {
              setShowAccounts((p) => !p);
              setShowPipeline(false);
              setShowIntel(false);
            }}
            showIntel={showIntel}
            onToggleIntel={
              intelEnabled
                ? () => {
                    setShowIntel((p) => !p);
                    setShowPipeline(false);
                    setShowAccounts(false);
                  }
                : undefined
            }
            onAddSignal={() => setAddSignalOpen(true)}
          />
        </div>
      </div>

      {addSignalOpen && (
        <ManualSignalForm
          onClose={() => setAddSignalOpen(false)}
          onCreated={() => {
            void qc.invalidateQueries({ queryKey: PIPELINE_SIGNALS_QUERY_KEY });
            void qc.invalidateQueries({ queryKey: PIPELINE_AGENCIES_QUERY_KEY });
            setPipelineToast("Manual signal added");
          }}
        />
      )}

      <RapidIqResearchPanel />

      {pipelineToast && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-xs text-emerald-300">
          {pipelineToast}
        </div>
      )}
      {pipelineActionError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-300">
          {pipelineActionError}
        </div>
      )}

      {showIntel ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <OpportunityIntelView />
        </div>
      ) : showAccounts ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <RapidIqAccountsView />
        </div>
      ) : showPipeline ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <PipelineView embedded items={queuedSignals} categoryLabel={FEED_TAB_LABELS[feedTab]} />
        </div>
      ) : (
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
                incomingSignals={incomingSignals}
                selectedId={selectedId}
                selectedSignalId={selectedSignalId}
                onSelect={selectOpportunity}
                onSelectSignal={selectIncoming}
                vertical={feedTab}
                demo={demo}
                pipelineOpportunityIds={inPipelineIds}
                addingPipelineId={addingPipelineId}
                dismissingId={dismissingId}
                onAddToPipeline={(opp) => void handleAddToPipeline(opp)}
                onDismissOpportunity={(opp) => void handleDismissOpportunity(opp)}
                onAddSignalToPipeline={(s) => void handleAddSignalToPipeline(s)}
                onDismissSignal={(s) => void handleDismissSignal(s)}
                pipelineEnabled={pipelineEnabled}
              />
            )}
          </div>

          {selectedIncoming ? (
            <IncomingSignalDetail
              signal={selectedIncoming}
              busy={
                addingPipelineId === selectedIncoming.signalId ||
                dismissingId === selectedIncoming.signalId
              }
              onClose={() => setSelectedSignalId(null)}
              onAddToPipeline={() => void handleAddSignalToPipeline(selectedIncoming)}
              onDismiss={() => void handleDismissSignal(selectedIncoming)}
            />
          ) : panelOpp ? (
            <OpportunityDetailPanel
              opportunity={panelOpp}
              signals={detail?.signals ?? []}
              contacts={detail?.contacts ?? []}
              sources={detail?.sources ?? []}
              mentioned={detail?.mentioned ?? []}
              demo={detail?.demo ?? demo}
              onClose={() => setSelectedId(null)}
              onAddToPipeline={() => void handleAddToPipeline(panelOpp)}
              onDismiss={() => void handleDismissOpportunity(panelOpp)}
              inPipeline={inPipelineIds.has(panelOpp.opportunityId)}
              pipelineBusy={addingPipelineId === panelOpp.opportunityId}
            />
          ) : selectedId && detailQ.isLoading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
              Loading detail…
            </div>
          ) : (
            <div className="hidden flex-1 flex-col items-center justify-center gap-3 p-8 text-center lg:flex">
              <div className="text-5xl opacity-[0.05]">⚡</div>
              <div className="text-sm font-semibold text-slate-400">Select an incoming item</div>
              <div className="max-w-[280px] text-xs text-slate-600">
                Dismiss it, or send it to Pipeline. Contact happens after you push Pipeline to CRM.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
