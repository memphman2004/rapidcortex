"use client";

import { useEffect, useState } from "react";
import {
  PSAP_OUTREACH_STATUSES,
  PSAP_OUTREACH_STATUS_CONFIG,
  type PsapOutreachStatus,
  type PsapProspectListQuery,
  type PsapProspectStats,
} from "rapid-cortex-shared";
import { Download, Search } from "lucide-react";
import { buildPsapExportUrl } from "@/lib/psap/psap-api";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM",
  "NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA",
  "WV","WI","WY","PR","VI","GU","AS","MP",
] as const;

type AddressFilter = "all" | "yes" | "no";

type Props = {
  query: PsapProspectListQuery;
  total: number;
  stats?: PsapProspectStats;
  onChange: (next: PsapProspectListQuery) => void;
};

export function PsapFilterBar({ query, total, stats, onChange }: Props) {
  const [searchDraft, setSearchDraft] = useState(query.search ?? "");
  const [verifiedOnly, setVerifiedOnly] = useState(Boolean(query.verifiedOnly));

  useEffect(() => {
    setSearchDraft(query.search ?? "");
  }, [query.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchDraft.trim();
      if ((query.search ?? "") !== next) {
        onChange({ ...query, search: next || undefined, page: 1 });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchDraft, query, onChange]);

  const addressFilter: AddressFilter =
    query.hasAddress === true ? "yes" : query.hasAddress === false ? "no" : "all";

  const exportHref = buildPsapExportUrl({
    ...query,
    page: undefined,
    pageSize: undefined,
    verifiedOnly: verifiedOnly || undefined,
  });

  return (
    <div className="space-y-2 rounded-lg border border-[#1e2130] bg-[#0f1117] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, city, county…"
            className="w-full rounded border border-[#1e2130] bg-[#0a0b0f] py-1.5 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-violet-500/40 focus:outline-none"
          />
        </div>

        <select
          value={query.state ?? ""}
          onChange={(e) =>
            onChange({ ...query, state: e.target.value || undefined, page: 1 })
          }
          className="rounded border border-[#1e2130] bg-[#0a0b0f] px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">All states</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={query.outreachStatus ?? ""}
          onChange={(e) =>
            onChange({
              ...query,
              outreachStatus: (e.target.value || undefined) as PsapOutreachStatus | undefined,
              page: 1,
            })
          }
          className="rounded border border-[#1e2130] bg-[#0a0b0f] px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="">All statuses</option>
          {PSAP_OUTREACH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PSAP_OUTREACH_STATUS_CONFIG[s].label}
              {stats ? ` (${stats.byStatus[s] ?? 0})` : ""}
            </option>
          ))}
        </select>

        <select
          value={addressFilter}
          onChange={(e) => {
            const v = e.target.value as AddressFilter;
            onChange({
              ...query,
              hasAddress: v === "all" ? undefined : v === "yes",
              page: 1,
            });
          }}
          className="rounded border border-[#1e2130] bg-[#0a0b0f] px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All addresses</option>
          <option value="yes">Address only</option>
          <option value="no">Missing address</option>
        </select>

        <span className="ml-auto font-mono text-xs text-slate-500">
          {total.toLocaleString()} PSAPs
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#1e2130]/80 pt-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="rounded border-slate-600"
          />
          Export verified addresses only
        </label>
        <a
          href={exportHref}
          title="Export filtered list for mailing campaign"
          className="inline-flex items-center gap-1.5 rounded border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200 hover:bg-violet-500/20"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </a>
        {addressFilter !== "yes" && stats && stats.total - stats.withAddress > 0 && (
          <p className="text-[11px] text-amber-400/80">
            {(stats.total - stats.withAddress).toLocaleString()} records have no street address
            and will export with city/state only. Verify before sending to mail house.
          </p>
        )}
        {addressFilter !== "yes" && !stats && (
          <p className="text-[11px] text-amber-400/80">
            Records without a street address export with city/state only. Verify before mail house.
          </p>
        )}
      </div>
    </div>
  );
}
