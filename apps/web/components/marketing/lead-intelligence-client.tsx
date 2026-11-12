"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  parseMarketingDashboardFilter,
  PRODUCT_MARKET_LABELS,
  serializeMarketingDashboardFilter,
  type MarketingDashboardFilter,
} from "rapid-cortex-shared";
import { MarketingFilterBar } from "./marketing-filter-bar";

// ─── API client ──────────────────────────────────────────────────────────────

async function fetchLeadIntelligence(filter: MarketingDashboardFilter) {
  const qs = serializeMarketingDashboardFilter(filter).toString();
  const res = await fetch(`/api/rc-admin/marketing/lead-intelligence${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load lead intelligence");
  const body = await res.json() as { success: boolean; data: IntelData };
  return body.data;
}

type LeadCard = {
  leadId: string;
  displayName: string;
  agencyName: string | null;
  agencyType: string | null;
  state: string | null;
  zone: string | null;
  market: string | null;
  pipelineStage: string;
  hotScore: number | null;
  signalCount: number;
  engagementCount: number;
  buyingSignalCount: number;
  recentActivities: { type: string; description: string; createdAt: string }[];
  nextAction: string | null;
  nextActionDate: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  attribution: { channel: string; utmCampaign: string | null } | null;
  interestedIn: string[];
};

type IntelData = {
  cards: LeadCard[];
  total: number;
  filter: MarketingDashboardFilter;
};

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color =
    score >= 70 ? "text-emerald-400 border-emerald-500/40" :
    score >= 40 ? "text-amber-400 border-amber-500/40" :
    "text-slate-400 border-slate-600/40";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

// ─── Stage pill ──────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  NEW: "bg-slate-700/60 text-slate-400",
  CONTACTED: "bg-blue-900/40 text-blue-400",
  ENGAGED: "bg-sky-900/40 text-sky-400",
  QUALIFIED: "bg-violet-900/40 text-violet-400",
  DISCOVERY: "bg-purple-900/40 text-purple-400",
  DEMO_SCHEDULED: "bg-amber-900/40 text-amber-400",
  DEMO_COMPLETED: "bg-orange-900/40 text-orange-400",
  PROPOSAL: "bg-rose-900/40 text-rose-400",
  PROCUREMENT: "bg-pink-900/40 text-pink-400",
  CONTRACTING: "bg-indigo-900/40 text-indigo-400",
  WON: "bg-emerald-900/40 text-emerald-400",
};

function StagePill({ stage }: { stage: string }) {
  const cls = STAGE_COLORS[stage] ?? "bg-slate-700/60 text-slate-400";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${cls}`}>
      {stage.replace(/_/g, " ")}
    </span>
  );
}

// ─── Agency Interest Card ─────────────────────────────────────────────────────

function AgencyCard({ card }: { card: LeadCard }) {
  const intentLevel =
    (card.hotScore ?? 0) >= 70 ? "High intent" :
    (card.hotScore ?? 0) >= 40 ? "Medium intent" :
    "Low intent";
  const intentColor =
    (card.hotScore ?? 0) >= 70 ? "text-emerald-400 bg-emerald-950/50 border-emerald-500/30" :
    (card.hotScore ?? 0) >= 40 ? "text-amber-400 bg-amber-950/50 border-amber-500/30" :
    "text-slate-500 bg-slate-800/50 border-slate-700/30";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Agency Interest Intelligence
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${intentColor}`}>
              {intentLevel}
            </span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-white">
            {card.agencyName ?? card.displayName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {card.market && (
              <span>{PRODUCT_MARKET_LABELS[card.market as keyof typeof PRODUCT_MARKET_LABELS] ?? card.market}</span>
            )}
            {card.state && <span>·</span>}
            {card.state && <span>{card.state}</span>}
            {card.zone && <span>·</span>}
            {card.zone && <span>{card.zone.replace("zone-", "Zone ")}</span>}
          </div>
        </div>
        <ScoreBadge score={card.hotScore} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-xl font-semibold tabular-nums text-white">{card.hotScore ?? "—"}</div>
          <div className="text-[10px] text-slate-500">Lead score</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold tabular-nums text-white">{card.engagementCount}</div>
          <div className="text-[10px] text-slate-500">Engagements</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold tabular-nums text-white">{card.buyingSignalCount}</div>
          <div className="text-[10px] text-slate-500">Buying signals</div>
        </div>
      </div>

      {/* Stage + campaign */}
      <div className="flex flex-wrap items-center gap-2">
        <StagePill stage={card.pipelineStage} />
        {card.attribution?.utmCampaign && (
          <span className="rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[11px] text-slate-400">
            {card.attribution.utmCampaign}
          </span>
        )}
        {card.interestedIn.slice(0, 2).map((p) => (
          <span key={p} className="rounded-full bg-sky-950/50 px-2.5 py-0.5 text-[11px] text-sky-400">
            {p}
          </span>
        ))}
      </div>

      {/* Recent activity */}
      {card.recentActivities.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Recent activity
          </p>
          {card.recentActivities.map((a, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="mt-0.5 text-slate-600">✓</span>
              <span className="line-clamp-1">{a.description || a.type}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggested next action (confirmed only — no hallucinated AI suggestions) */}
      {card.nextAction && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-950/20 p-3">
          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky-400">
            ✦ Suggested next action
          </p>
          <p className="text-xs text-slate-300">{card.nextAction}</p>
          {card.nextActionDate && (
            <p className="mt-1 text-[11px] text-slate-500">
              Target: {new Date(card.nextActionDate).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Assignee + open link */}
      <div className="flex items-center justify-between pt-1">
        {card.assignedToName ? (
          <span className="text-xs text-slate-500">Assigned: {card.assignedToName}</span>
        ) : (
          <span className="text-xs text-slate-600">Unassigned</span>
        )}
        <Link
          href={`/rc-admin/leads?lead=${card.leadId}`}
          className="rounded-lg bg-sky-700/20 px-3 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-700/40"
        >
          Open lead →
        </Link>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function LeadIntelligenceClient() {
  const sp = useSearchParams();
  const filter = parseMarketingDashboardFilter(Object.fromEntries(sp.entries()));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["marketing-lead-intelligence", filter],
    queryFn: () => fetchLeadIntelligence(filter),
  });

  return (
    <div className="space-y-6">
      <MarketingFilterBar filter={filter} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {isLoading
            ? "Loading…"
            : `${data?.total ?? 0} active ${(data?.total ?? 0) === 1 ? "lead" : "leads"} matching filters`}
        </p>
        <Link
          href="/rc-admin/leads"
          className="text-xs text-sky-400 hover:underline"
        >
          Open full CRM →
        </Link>
      </div>

      {isError && (
        <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-400">
          Failed to load lead intelligence data.
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (data?.cards ?? []).length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] px-6 py-12 text-center">
          <p className="text-slate-400">No active leads match the selected filters.</p>
          <p className="mt-1 text-sm text-slate-600">
            Try clearing the market or zone filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.cards ?? []).map((card) => (
            <AgencyCard key={card.leadId} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
