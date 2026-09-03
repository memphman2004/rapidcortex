"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Conference, ConferenceChangeRecord, ConferencePriority } from "rapid-cortex-shared";
import { conferencePriority, conferenceSourceUrl, pendingConferenceChanges } from "rapid-cortex-shared";
import {
  changeBadge,
  changeTypeTitle,
  compareConferences,
  conferencePriorityLabel,
  displayFee,
  formatCheckedAgo,
  formatConferenceDates,
  formatDetectedAt,
  groupConferencesByPriority,
  type ConferenceSortKey,
} from "@/lib/conferences/format";

type Props = {
  conferences: Conference[];
  compact?: boolean;
  groupByPriority?: boolean;
  emptyLabel?: string;
  busyId?: string | null;
  onEdit?: (conf: Conference) => void;
  onDismiss: (conf: Conference, change: ConferenceChangeRecord) => void;
  onApply: (conf: Conference, change: ConferenceChangeRecord) => void;
};

const TONE_CLASS: Record<string, string> = {
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  red: "border-red-500/50 bg-red-500/20 text-red-200",
  slate: "border-white/10 bg-white/[0.04] text-slate-400",
};

function PriorityDot({ priority, className }: { priority: ConferencePriority; className?: string }) {
  const fill =
    priority === "red" ? "bg-red-500" : priority === "amber" ? "bg-amber-400" : "bg-emerald-500";
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${fill} ${className ?? ""}`}
      title={conferencePriorityLabel(priority)}
      aria-label={conferencePriorityLabel(priority)}
    />
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function verticalLabel(vertical?: Conference["vertical"]): string | null {
  if (!vertical) return null;
  if (vertical === "911") return "911";
  if (vertical === "campus") return "Campus";
  if (vertical === "venue") return "Venue";
  if (vertical === "airport") return "Airport";
  return vertical;
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  align,
  onSort,
}: {
  label: string;
  column: ConferenceSortKey;
  sortKey: ConferenceSortKey;
  sortDir: "asc" | "desc";
  align?: "right";
  onSort: (column: ConferenceSortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <th
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : ""}`}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-slate-300 ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        <span className="text-[10px] text-slate-600">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

export function ConferencesTable({
  conferences,
  compact,
  groupByPriority,
  emptyLabel,
  busyId,
  onEdit,
  onDismiss,
  onApply,
}: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ConferenceSortKey>("dates");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setOpenKey(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const rows = useMemo(() => {
    const copy = [...conferences];
    copy.sort((a, b) => {
      const cmp = compareConferences(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [conferences, sortDir, sortKey]);

  const groups = useMemo(() => {
    if (!groupByPriority) {
      return [{ priority: null as ConferencePriority | null, items: rows }];
    }
    return groupConferencesByPriority(rows);
  }, [groupByPriority, rows]);

  const colCount = compact ? 6 : 7;

  function onSort(column: ConferenceSortKey) {
    if (sortKey === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir("asc");
  }

  if (conferences.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-slate-500">
        {emptyLabel ?? "No conferences yet."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-[11px] uppercase tracking-wide text-slate-500">
            <SortHeader label="Event" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Dates" column="dates" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Location" column="location" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            {!compact ? (
              <SortHeader label="Venue" column="venue" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            ) : null}
            <SortHeader
              label="Registration"
              column="registrationFee"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortHeader label="Booth" column="boothFee" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader
              label="Status"
              column="status"
              sortKey={sortKey}
              sortDir={sortDir}
              align="right"
              onSort={onSort}
            />
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.priority ?? "all"}>
              {group.priority ? (
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  <td colSpan={colCount} className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <PriorityDot priority={group.priority} />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                        {conferencePriorityLabel(group.priority)}
                      </span>
                      <span className="text-[11px] text-slate-600">{group.items.length}</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {group.items.map((conf) => {
                const pending = pendingConferenceChanges(conf);
                const source = conferenceSourceUrl(conf);
                const priority = conferencePriority(conf);
                return (
                  <tr
                    key={conf.conferenceId}
                    className="border-b border-white/[0.04] align-top hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <PriorityDot priority={priority} className="mt-1.5" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {conf.isCancelled ? (
                              <span className="text-sm font-medium text-red-300 line-through">{conf.name}</span>
                            ) : (
                              <span className="text-sm font-medium text-white">{conf.name}</span>
                            )}
                            {verticalLabel(conf.vertical) ? (
                              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                {verticalLabel(conf.vertical)}
                              </span>
                            ) : null}
                            {pending.map((change) => {
                              const badge = changeBadge(change);
                              const key = `${conf.conferenceId}:${change.changeId}`;
                              const open = openKey === key;
                              return (
                                <div key={change.changeId} className="relative" ref={open ? popoverRef : undefined}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenKey(open ? null : key)}
                                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${TONE_CLASS[badge.tone]}`}
                                  >
                                    {badge.label}
                                  </button>
                                  {open ? (
                                    <div className="absolute left-0 z-30 mt-1.5 w-72 rounded-lg border border-white/10 bg-[#0d1524] p-3 shadow-xl">
                                      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                        Change detected — {formatDetectedAt(change.detectedAt)}
                                      </div>
                                      <p className="mt-2 text-xs text-slate-200">
                                        {changeTypeTitle(change.changeType)}: {change.previousValue} →{" "}
                                        {change.newValue}
                                      </p>
                                      <p className="mt-1 text-[11px] text-slate-500">
                                        Source: {hostname(change.sourceUrl || source)}
                                      </p>
                                      <p className="text-[11px] text-slate-500">Confidence: {change.confidence}</p>
                                      <div className="mt-3 flex flex-wrap gap-1.5">
                                        {badge.dismissible ? (
                                          <button
                                            type="button"
                                            disabled={busyId === conf.conferenceId}
                                            onClick={() => {
                                              onDismiss(conf, change);
                                              setOpenKey(null);
                                            }}
                                            className="rounded border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 disabled:opacity-50"
                                          >
                                            Dismiss
                                          </button>
                                        ) : null}
                                        {change.sourceUrl || source ? (
                                          <a
                                            href={change.sourceUrl || source}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded border border-white/10 px-2 py-1 text-[11px] text-sky-300 hover:bg-white/5"
                                          >
                                            View Source
                                          </a>
                                        ) : null}
                                        <button
                                          type="button"
                                          disabled={busyId === conf.conferenceId}
                                          onClick={() => {
                                            onApply(conf, change);
                                            setOpenKey(null);
                                          }}
                                          className="rounded bg-sky-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:opacity-50"
                                        >
                                          Update Record
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                          {source ? (
                            <a
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 inline-block text-[11px] text-slate-500 hover:text-sky-400"
                            >
                              {hostname(source)}
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                      {formatConferenceDates(conf.startDate, conf.endDate)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{conf.location}</td>
                    {!compact ? (
                      <td className="px-3 py-2.5 text-slate-400">{conf.venue ?? "—"}</td>
                    ) : null}
                    <td className="px-3 py-2.5 text-slate-300">{displayFee(conf.registrationFee)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{displayFee(conf.boothFee)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-600">{formatCheckedAgo(conf.lastChecked)}</span>
                        {onEdit ? (
                          <button
                            type="button"
                            onClick={() => onEdit(conf)}
                            className="text-[11px] text-slate-500 hover:text-sky-300"
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
