"use client";

import { useState } from "react";
import { Building2, X } from "lucide-react";
import type {
  MentionedEntity,
  RapidIqContact,
  RapidIqOpportunity,
  RapidIqSignal,
  RapidIqSource,
} from "@/lib/rapid-iq/types";
import { fitLabel, formatShortDate, scoreFontColor } from "@/lib/rapid-iq/scoring";
import { ContactIntelligenceTab } from "./contact-intelligence-tab";
import { SignalAnalysisTab } from "./signal-analysis-tab";
import { SourceViewerTab } from "./source-viewer-tab";

type Tab = "analysis" | "source" | "intel";

type Props = {
  opportunity: RapidIqOpportunity;
  signals: RapidIqSignal[];
  contacts: RapidIqContact[];
  sources: RapidIqSource[];
  mentioned: MentionedEntity[];
  demo?: boolean;
  onClose: () => void;
  onConvert: () => void;
};

export function OpportunityDetailPanel({
  opportunity,
  signals,
  contacts,
  sources,
  mentioned,
  demo,
  onClose,
  onConvert,
}: Props) {
  const [tab, setTab] = useState<Tab>("analysis");

  const tabs: { id: Tab; label: string }[] = [
    { id: "analysis", label: "Signal Analysis" },
    { id: "source", label: "Source" },
    { id: "intel", label: "Agency Intel" },
  ];

  return (
    <div className="flex h-full w-full max-w-xl flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0a1628] lg:max-w-2xl">
      <div className="flex items-start justify-between border-b border-slate-800 p-4">
        <div className="min-w-0 flex-1 pr-4">
          <p className="text-sm font-semibold leading-snug text-slate-100">{opportunity.aiHeadline}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <Building2 size={10} />
            <span>
              {opportunity.agencyName}, {opportunity.county}, {opportunity.state}
            </span>
            <span>·</span>
            <span>{opportunity.agencyType.replace(/_/g, " ")}</span>
            {opportunity.population != null && (
              <>
                <span>·</span>
                <span>Pop. {opportunity.population.toLocaleString()}</span>
              </>
            )}
            <span>·</span>
            <span>{formatShortDate(opportunity.lastSignalAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-2xl font-bold ${scoreFontColor(opportunity.opportunityScore)}`}>
            {opportunity.opportunityScore}
          </span>
          <span className="text-[10px] font-bold uppercase text-slate-500">
            {fitLabel(opportunity.fitScore)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 text-slate-600 transition hover:text-slate-400"
          aria-label="Close detail panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-2">
        <button
          type="button"
          onClick={() => setTab("source")}
          className="rounded border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"
        >
          View Source
        </button>
        <button
          type="button"
          className="rounded border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20"
        >
          Generate Email
        </button>
        <button
          type="button"
          onClick={onConvert}
          className="rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
        >
          Add to Pipeline
        </button>
      </div>

      <div className="flex border-b border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "flex-1 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide transition",
              tab === t.id
                ? "border-b-2 border-sky-500 text-sky-300"
                : "text-slate-600 hover:text-slate-400",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "analysis" && (
          <SignalAnalysisTab
            opportunity={opportunity}
            contacts={contacts}
            mentioned={mentioned}
            demo={demo}
            onConvert={onConvert}
          />
        )}
        {tab === "source" && <SourceViewerTab sources={sources} />}
        {tab === "intel" && (
          <ContactIntelligenceTab opportunity={opportunity} contacts={contacts} />
        )}
      </div>

      {signals.length > 0 && tab === "analysis" && (
        <div className="hidden border-t border-slate-900/80 px-4 py-2 text-[10px] text-slate-700">
          {signals.length} signal{signals.length !== 1 ? "s" : ""} on record
        </div>
      )}
    </div>
  );
}
