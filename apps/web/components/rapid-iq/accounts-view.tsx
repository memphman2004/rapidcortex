"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PROCUREMENT_STAGE_LABELS,
  RAPID_IQ_CONTACT_CONFIDENCE_LABELS,
  type RapidIqAgencyContact,
  type RapidIqAgencyProfile,
  type RapidIqContactConfidence,
  type RapidIqPipelineSignal,
} from "rapid-cortex-shared";
import {
  getPipelineAgencies,
  getPipelineAgencyDetail,
  PIPELINE_AGENCIES_QUERY_KEY,
} from "@/lib/rapid-iq/pipeline-api";
import { formatShortDate, formatTimeAgo, intentFitBadgeClass } from "@/lib/rapid-iq/scoring";

function ScoreCell({ score }: { score: number }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${intentFitBadgeClass(score)}`}>
      {score}
    </span>
  );
}

function ContactBadge({ confidence }: { confidence: number }) {
  const key = Math.max(0, Math.min(5, Math.round(confidence))) as RapidIqContactConfidence;
  const meta = RAPID_IQ_CONTACT_CONFIDENCE_LABELS[key];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ color: meta.color, border: `1px solid ${meta.color}55` }}
    >
      {meta.label}
    </span>
  );
}

export function RapidIqAccountsView() {
  const [stateFilter, setStateFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: PIPELINE_AGENCIES_QUERY_KEY,
    queryFn: getPipelineAgencies,
    staleTime: 30_000,
  });

  const detailQ = useQuery({
    queryKey: [...PIPELINE_AGENCIES_QUERY_KEY, selectedId],
    queryFn: () => getPipelineAgencyDetail(selectedId!),
    enabled: Boolean(selectedId),
  });

  const agencies = useMemo(() => {
    return (listQ.data ?? []).filter((a) => {
      if (stateFilter !== "all" && a.state !== stateFilter) return false;
      if (typeFilter !== "all" && a.agencyType !== typeFilter) return false;
      return true;
    });
  }, [listQ.data, stateFilter, typeFilter]);

  const states = useMemo(
    () => [...new Set((listQ.data ?? []).map((a) => a.state).filter(Boolean))].sort() as string[],
    [listQ.data],
  );
  const types = useMemo(
    () => [...new Set((listQ.data ?? []).map((a) => a.agencyType).filter(Boolean))].sort(),
    [listQ.data],
  );

  const selected = detailQ.data;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1 overflow-auto p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
          >
            <option value="all">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {listQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading accounts…</p>
        ) : agencies.length === 0 ? (
          <p className="text-sm text-slate-500">
            No agency profiles yet. Profiles are created when pipeline signals include an agency name.
          </p>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Agency</th>
                <th className="py-2 pr-3 font-semibold">State</th>
                <th className="py-2 pr-3 font-semibold">Type</th>
                <th className="py-2 pr-3 font-semibold">Signals</th>
                <th className="py-2 pr-3 font-semibold">Intent</th>
                <th className="py-2 pr-3 font-semibold">Fit</th>
                <th className="py-2 pr-3 font-semibold">Stage</th>
                <th className="py-2 font-semibold">Last signal</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((row: RapidIqAgencyProfile) => (
                <tr
                  key={row.agencyId}
                  className={`cursor-pointer border-b border-slate-900 hover:bg-slate-900/60 ${
                    selectedId === row.agencyId ? "bg-sky-950/40" : ""
                  }`}
                  onClick={() => setSelectedId(row.agencyId)}
                >
                  <td className="py-2 pr-3 font-semibold text-slate-100">{row.name}</td>
                  <td className="py-2 pr-3 text-slate-400">{row.state ?? "—"}</td>
                  <td className="py-2 pr-3 uppercase text-slate-400">{row.agencyType}</td>
                  <td className="py-2 pr-3 tabular-nums text-slate-300">{row.signalCount}</td>
                  <td className="py-2 pr-3">
                    <ScoreCell score={row.buyingIntentScore} />
                  </td>
                  <td className="py-2 pr-3">
                    <ScoreCell score={row.productFitScore} />
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {PROCUREMENT_STAGE_LABELS[row.procurementStage]?.label ?? row.procurementStage}
                  </td>
                  <td className="py-2 text-slate-500">{formatTimeAgo(row.lastSignalDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <aside className="w-full max-w-md shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0a1628] p-4">
          <button
            type="button"
            className="mb-3 text-[11px] text-slate-500 hover:text-slate-300"
            onClick={() => setSelectedId(null)}
          >
            Close
          </button>
          {detailQ.isLoading || !selected ? (
            <p className="text-sm text-slate-500">Loading agency…</p>
          ) : (
            <AgencyDetail
              agency={selected.agency}
              contacts={selected.contacts}
              signals={selected.signals}
            />
          )}
        </aside>
      )}
    </div>
  );
}

function AgencyDetail({
  agency,
  contacts,
  signals,
}: {
  agency: RapidIqAgencyProfile;
  contacts: RapidIqAgencyContact[];
  signals: RapidIqPipelineSignal[];
}) {
  const sortedContacts = [...contacts].sort((a, b) => b.confidence - a.confidence);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white">
          {agency.name}
          {agency.state ? `, ${agency.state}` : ""}
        </h3>
        <p className="mt-1 text-[11px] text-slate-500">
          {agency.agencyType} · {agency.signalCount} signals · {agency.recommendedAction}
        </p>
      </div>
      <div className="flex gap-3">
        <div>
          <div className="text-[9px] uppercase text-slate-500">Intent</div>
          <ScoreCell score={agency.buyingIntentScore} />
        </div>
        <div>
          <div className="text-[9px] uppercase text-slate-500">Fit</div>
          <ScoreCell score={agency.productFitScore} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Key contacts</h4>
        {sortedContacts.length === 0 ? (
          <p className="text-[11px] text-slate-600">No contacts yet. High-intent signals trigger Apollo/Hunter.</p>
        ) : (
          <ul className="space-y-2">
            {sortedContacts.map((c) => (
              <li key={c.contactId} className="rounded border border-slate-800 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-200">{c.name}</span>
                  <ContactBadge confidence={c.confidence} />
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400">{c.title || c.role || "—"}</div>
                {c.email && <div className="text-[11px] text-sky-300">{c.email}</div>}
                <div className="mt-1 text-[10px] text-slate-600">
                  {c.sourceName} · {formatShortDate(c.lastVerified)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Linked signals</h4>
        <ul className="space-y-2">
          {signals.map((s) => (
            <li key={s.signalId} className="text-[11px] text-slate-300">
              <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                {s.rawTitle}
              </a>
              <div className="text-slate-500">{s.excerpt || s.summary}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
