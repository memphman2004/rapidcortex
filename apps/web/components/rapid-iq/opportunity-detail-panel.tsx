"use client";

import { useState } from "react";
import { Building2, FileText, X } from "lucide-react";
import {
  fetchOutreach,
  fetchRfpOutline,
  fetchTalkingPoints,
  type RfpOutlineResult,
} from "@/lib/rapid-iq/api";
import type {
  MentionedEntity,
  RapidIqContact,
  RapidIqOpportunity,
  RapidIqSignal,
  RapidIqSource,
} from "@/lib/rapid-iq/types";
import { fitLabel, formatShortDate, scoreFontColor } from "@/lib/rapid-iq/scoring";
import { ContactIntelligenceTab } from "./contact-intelligence-tab";
import { OutreachModal } from "./outreach-modal";
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

function buildLocalOutreachBody(opportunity: RapidIqOpportunity, talkingPoints: string[]): string {
  const points =
    talkingPoints.length > 0
      ? talkingPoints
      : [
          `Reference the ${opportunity.aiHeadline} signal in your opener.`,
          "Ask about timeline for evaluation.",
          "Ask which budget cycle funds the modernization.",
          "Ask which CAD/NG911 stack they run today.",
          `Offer a 30-minute Rapid Cortex Core demo tailored to ${opportunity.agencyName}.`,
        ];
  const summary = opportunity.aiSummary?.trim() || opportunity.aiHeadline;
  return [
    "Hi Director,",
    "",
    `I noticed ${opportunity.aiHeadline}.`,
    "",
    summary,
    "",
    "Talking points for our conversation:",
    ...points.map((p, i) => `${i + 1}. ${p}`),
    "",
    `Would you have 20 minutes this week for a brief Rapid Cortex overview tailored to ${opportunity.agencyName}?`,
    "",
    "Best,",
    "Rapid Cortex",
  ].join("\n");
}

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
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [outreachDraft, setOutreachDraft] = useState<{ subject: string; body: string } | null>(
    null,
  );
  const [generatingRfp, setGeneratingRfp] = useState(false);
  const [rfpOutline, setRfpOutline] = useState<RfpOutlineResult | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "analysis", label: "Signal Analysis" },
    { id: "source", label: "Source" },
    { id: "intel", label: "Agency Intel" },
  ];

  async function handleGenerateEmail() {
    setGeneratingEmail(true);
    setEmailError(null);
    try {
      let talkingPoints =
        opportunity.talkingPoints && opportunity.talkingPoints.length > 0
          ? opportunity.talkingPoints
          : [];
      if (talkingPoints.length === 0) {
        talkingPoints = await fetchTalkingPoints(opportunity.opportunityId, demo).catch(() => []);
      }

      const result = await fetchOutreach(opportunity.opportunityId, undefined, demo);
      const subject =
        result.subject?.trim() || `Rapid Cortex — ${opportunity.agencyName}`;
      let body = result.body?.trim() ?? "";
      if (!body) {
        body = buildLocalOutreachBody(opportunity, talkingPoints);
      } else if (
        talkingPoints.length > 0 &&
        !/talking points/i.test(body) &&
        !talkingPoints.some((p) => body.includes(p.slice(0, 32)))
      ) {
        body = `${body}\n\nTalking points for our conversation:\n${talkingPoints
          .map((p, i) => `${i + 1}. ${p}`)
          .join("\n")}`;
      }

      setOutreachDraft({ subject, body });
      setOutreachOpen(true);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to generate email");
    } finally {
      setGeneratingEmail(false);
    }
  }

  async function handleDraftRfpOutline() {
    setGeneratingRfp(true);
    try {
      const outline = await fetchRfpOutline(opportunity.opportunityId, demo);
      setRfpOutline(outline);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "RFP outline failed");
    } finally {
      setGeneratingRfp(false);
    }
  }

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
          disabled={generatingEmail}
          onClick={() => void handleGenerateEmail()}
          className="rounded border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300 hover:bg-sky-500/20 disabled:opacity-50"
        >
          {generatingEmail ? "Generating…" : "Generate Email"}
        </button>
        {opportunity.tags.includes("RFP LIVE") && (
          <button
            type="button"
            disabled={generatingRfp}
            onClick={() => void handleDraftRfpOutline()}
            className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            <FileText size={11} />
            {generatingRfp ? "Analyzing RFP…" : "Draft Response Outline"}
          </button>
        )}
        <button
          type="button"
          onClick={onConvert}
          className="rounded bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
        >
          Add to Pipeline
        </button>
      </div>

      {emailError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] text-red-300">
          {emailError}
        </div>
      )}

      {rfpOutline && (
        <div className="max-h-48 overflow-y-auto border-b border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[11px] text-slate-300">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-400">
            RFP Response Outline
          </div>
          <p className="mb-2 text-slate-200">{rfpOutline.executiveSummary}</p>
          {rfpOutline.requirements.slice(0, 4).map((r) => (
            <div key={r.requirement} className="mb-1 text-slate-400">
              <span className="text-slate-300">{r.requirement}</span>
              {" → "}
              {r.rcFeature}: {r.rcCapability}
            </div>
          ))}
          {rfpOutline.recommendedApproach && (
            <p className="mt-2 italic text-slate-500">{rfpOutline.recommendedApproach}</p>
          )}
        </div>
      )}

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
            onDraftEmail={() => void handleGenerateEmail()}
            draftingEmail={generatingEmail}
          />
        )}
        {tab === "source" && <SourceViewerTab sources={sources} />}
        {tab === "intel" && (
          <ContactIntelligenceTab opportunity={opportunity} contacts={contacts} demo={demo} />
        )}
      </div>

      {signals.length > 0 && tab === "analysis" && (
        <div className="hidden border-t border-slate-900/80 px-4 py-2 text-[10px] text-slate-700">
          {signals.length} signal{signals.length !== 1 ? "s" : ""} on record
        </div>
      )}

      <OutreachModal
        isOpen={outreachOpen && Boolean(outreachDraft)}
        onClose={() => setOutreachOpen(false)}
        subject={outreachDraft?.subject ?? ""}
        body={outreachDraft?.body ?? ""}
        agencyName={opportunity.agencyName}
      />
    </div>
  );
}
