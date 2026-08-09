"use client";

import { Mail } from "lucide-react";
import type { MentionedEntity, RapidIqContact, RapidIqOpportunity } from "@/lib/rapid-iq/types";
import { ContactSearchLive } from "./contact-search-live";
import { SignalChat } from "./signal-chat";
import { TalkingPointsSection } from "./talking-points-section";

function FormattedSummary({ text }: { text: string }) {
  const parts = text.split(/(\$[\d,]+(?:\.\d+)?(?:[KMB])?)/g);
  return (
    <p className="text-sm leading-relaxed text-slate-300">
      {parts.map((part, i) =>
        part.startsWith("$") ? (
          <strong key={i} className="font-semibold text-amber-300">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </p>
  );
}

type Props = {
  opportunity: RapidIqOpportunity;
  contacts: RapidIqContact[];
  mentioned: MentionedEntity[];
  demo?: boolean;
  onConvert: () => void;
};

export function SignalAnalysisTab({ opportunity, contacts, mentioned, demo, onConvert }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <FormattedSummary text={opportunity.aiSummary} />
        <ContactSearchLive contacts={contacts} mentioned={mentioned} />
        <div className="border-t border-slate-800 pt-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            AI Assist
          </div>
          <div className="flex flex-wrap gap-2">
            <TalkingPointsSection opportunity={opportunity} demo={demo} />
            <button
              type="button"
              className="flex items-center gap-1.5 rounded border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
            >
              <Mail size={11} /> Draft Email
            </button>
            <button
              type="button"
              onClick={onConvert}
              className="ml-auto flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-sky-500"
            >
              Add to Pipeline
            </button>
          </div>
        </div>
      </div>
      <SignalChat opportunityId={opportunity.opportunityId} demo={demo} />
    </div>
  );
}
