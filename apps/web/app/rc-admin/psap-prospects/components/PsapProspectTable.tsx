"use client";

import type { PsapOutreachStatus, PsapProspect } from "rapid-cortex-shared";
import { PSAP_OUTREACH_STATUS_CONFIG } from "rapid-cortex-shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PsapQuickStatusMenu } from "./PsapQuickStatusMenu";

type SortBy = NonNullable<
  "psapName" | "state" | "outreachStatus" | "lastContactedAt" | "updatedAt"
>;

type Props = {
  items: PsapProspect[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  selectedId?: string | null;
  sortBy?: SortBy;
  sortDir?: "asc" | "desc";
  isLoading?: boolean;
  onSelect: (prospect: PsapProspect) => void;
  onPageChange: (page: number) => void;
  onSort: (sortBy: SortBy) => void;
  onStatusChange: (psapId: string, status: PsapOutreachStatus) => void;
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir?: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left text-[10px] font-semibold uppercase tracking-wide ${
        active ? "text-violet-300" : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
      {active ? (dir === "desc" ? " ↓" : " ↑") : ""}
    </button>
  );
}

export function PsapProspectTable({
  items,
  total,
  page,
  pageSize,
  hasMore,
  selectedId,
  sortBy = "psapName",
  sortDir = "asc",
  isLoading,
  onSelect,
  onPageChange,
  onSort,
  onStatusChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e2130] bg-[#0f1117]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#1e2130] bg-[#0a0b0f] text-left">
              <th className="w-[120px] px-3 py-2">
                <SortBtn
                  label="Status"
                  active={sortBy === "outreachStatus"}
                  dir={sortDir}
                  onClick={() => onSort("outreachStatus")}
                />
              </th>
              <th className="px-3 py-2">
                <SortBtn
                  label="PSAP Name"
                  active={sortBy === "psapName"}
                  dir={sortDir}
                  onClick={() => onSort("psapName")}
                />
              </th>
              <th className="w-[60px] px-3 py-2">
                <SortBtn
                  label="State"
                  active={sortBy === "state"}
                  dir={sortDir}
                  onClick={() => onSort("state")}
                />
              </th>
              <th className="w-[120px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                County
              </th>
              <th className="w-[120px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                City
              </th>
              <th className="w-[130px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Phone
              </th>
              <th className="w-[150px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Contact
              </th>
              <th className="w-[80px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Addr
              </th>
              <th className="w-[120px] px-3 py-2">
                <SortBtn
                  label="Last Contact"
                  active={sortBy === "lastContactedAt"}
                  dir={sortDir}
                  onClick={() => onSort("lastContactedAt")}
                />
              </th>
              <th className="w-[120px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Assigned
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                  Loading prospects…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-slate-500">
                  No PSAPs match the current filters.
                </td>
              </tr>
            ) : (
              items.map((p, i) => {
                const selected = selectedId === p.psapId;
                const cfg = PSAP_OUTREACH_STATUS_CONFIG[p.outreachStatus];
                const hasAddr = Boolean(p.mailingAddress?.streetAddress?.trim());
                return (
                  <tr
                    key={p.psapId}
                    onClick={() => onSelect(p)}
                    className={`cursor-pointer border-b border-[#1e2130]/60 transition-colors hover:bg-[#13161e] ${
                      selected ? "bg-[#1e2130]" : i % 2 === 0 ? "bg-[#0f1117]" : "bg-[#0a0b0f]"
                    }`}
                    style={
                      selected
                        ? { boxShadow: `inset 2px 0 0 ${cfg.color}` }
                        : undefined
                    }
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <PsapQuickStatusMenu
                        status={p.outreachStatus}
                        onSelect={(status) => onStatusChange(p.psapId, status)}
                      />
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2 font-medium text-slate-200">
                      {p.psapName}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{p.state}</td>
                    <td className="truncate px-3 py-2 text-slate-400">{p.county}</td>
                    <td className="truncate px-3 py-2 text-slate-400">{p.city}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{p.phone}</td>
                    <td className="truncate px-3 py-2 text-slate-400">
                      {p.primaryContactName ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-sm">
                      {hasAddr ? (
                        <span className="text-emerald-400" title="Has street address">
                          ✓
                        </span>
                      ) : (
                        <span className="text-rose-400" title="Missing street address">
                          ✗
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatDate(p.lastContactedAt)}
                    </td>
                    <td className="truncate px-3 py-2 text-slate-400">
                      {p.assignedToName ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#1e2130] px-3 py-2">
        <p className="font-mono text-[11px] text-slate-500">
          Page {page} of {totalPages} · {total.toLocaleString()} total
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-xs text-slate-300 hover:bg-[#13161e] disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            disabled={!hasMore && page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex items-center gap-1 rounded border border-[#1e2130] px-2 py-1 text-xs text-slate-300 hover:bg-[#13161e] disabled:opacity-40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
