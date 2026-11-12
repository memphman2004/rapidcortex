"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

async function fetchCampaignSummary() {
  const res = await fetch("/api/rc-admin/sales-automation", { credentials: "include" });
  if (!res.ok) return null;
  const body = await res.json() as Record<string, unknown>;
  return body;
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

export function CampaignManagerHub() {
  const { data, isLoading } = useQuery({
    queryKey: ["campaign-summary-hub"],
    queryFn: fetchCampaignSummary,
  });

  // Extract top-level SES and Apollo stats if available
  const sesCampaigns = (data as any)?.campaigns ?? [];
  const apolloConnected = (data as any)?.apollo?.connected ?? false;
  const apolloCampaigns: unknown[] = (data as any)?.apollo?.campaigns ?? [];

  const totalSent = sesCampaigns.reduce((acc: number, c: any) => acc + (c.delivered ?? 0), 0);
  const totalOpened = sesCampaigns.reduce((acc: number, c: any) => acc + (c.opened ?? 0), 0);
  const totalReplied = sesCampaigns.reduce((acc: number, c: any) => acc + (c.replied ?? 0), 0);

  const openRate = totalSent > 0 ? `${Math.round((totalOpened / totalSent) * 100)}%` : "—";
  const replyRate = totalSent > 0 ? `${Math.round((totalReplied / totalSent) * 100)}%` : "—";

  return (
    <div className="space-y-6">
      {/* SES / Signal campaigns */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Email Campaigns (SES)</h2>
          <Link
            href="/rc-admin/sales-automation"
            className="rounded-lg bg-sky-700/20 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-700/40"
          >
            Manage Campaigns →
          </Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatChip label="Campaigns" value={sesCampaigns.length} />
            <StatChip label="Delivered" value={totalSent.toLocaleString()} />
            <StatChip label="Open rate" value={openRate} />
            <StatChip label="Reply rate" value={replyRate} />
          </div>
        )}
        {sesCampaigns.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Recent Campaigns
            </p>
            {sesCampaigns.slice(0, 5).map((c: any) => (
              <div key={c.campaignId ?? c.name} className="flex items-center justify-between text-sm">
                <span className="truncate text-slate-300">{c.name ?? c.subject ?? "Campaign"}</span>
                <span className="ml-4 shrink-0 text-slate-500">
                  {c.delivered ?? 0} sent
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apollo sequences */}
      <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Apollo Sequences</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              apolloConnected
                ? "bg-emerald-950/50 text-emerald-400"
                : "bg-slate-800/50 text-slate-500"
            }`}
          >
            {apolloConnected ? "Connected" : "Not connected"}
          </span>
        </div>
        {apolloConnected ? (
          <div className="space-y-2">
            {apolloCampaigns.length === 0 ? (
              <p className="text-sm text-slate-500">No Apollo sequences loaded.</p>
            ) : (
              apolloCampaigns.slice(0, 5).map((c: any) => (
                <div key={c.id ?? c.name} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-300">{c.name ?? "Sequence"}</span>
                  <span className="ml-4 shrink-0 text-slate-500">
                    {c.delivered ?? 0} delivered
                  </span>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Connect Apollo in the campaign settings.</p>
        )}
      </div>

      {/* Email List + NexCortiQ Signal */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Email List</h2>
          <p className="mb-4 text-xs text-slate-400">
            Manage your subscriber list, import from Apollo, and sync to campaigns.
          </p>
          <Link
            href="/rc-admin/email-list"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700/20 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-sky-700/40"
          >
            Open Email List →
          </Link>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0a1628] p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">NexCortiQ Signal</h2>
          <p className="mb-4 text-xs text-slate-400">
            Newsletter editions — approve, send, and track open and click rates.
          </p>
          <Link
            href="/rc-admin/signal-feed"
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700/20 px-4 py-2 text-sm font-medium text-violet-400 hover:bg-violet-700/40"
          >
            Open Signal Feed →
          </Link>
        </div>
      </div>
    </div>
  );
}
