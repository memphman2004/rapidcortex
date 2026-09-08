"use client";

type Handoff = {
  action?: string;
  continueAiConversation?: boolean;
  classification?: string;
  spokenCallerScript?: string;
  spokenReceiverSummary?: string;
  transcriptSummary?: string;
  premiseHazards?: Array<{ code: string; summary: string; officerSafety: boolean }>;
  duplicateCadIds?: string[];
  chronicLocation?: boolean;
  repeatCaller?: boolean;
  ttyMode?: boolean;
  language?: string;
  routing?: { destinationType?: string; displayName?: string };
};

export function CallAssistHandoffPanel({
  handoff,
  escalationLabel,
  officerSafetyLabel,
}: {
  handoff: Handoff | null | undefined;
  escalationLabel?: string;
  officerSafetyLabel?: string;
}) {
  if (!handoff) {
    return (
      <p className="text-sm text-slate-400">No transfer package yet. Intake is still in progress.</p>
    );
  }
  const emergency = handoff.action === "TRANSFER_911";
  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">Warm transfer / handoff</h2>
        {emergency ? (
          <span className="rounded bg-rose-900/80 px-2 py-0.5 text-xs font-semibold text-rose-100">
            {escalationLabel ?? "Emergency escalation"}
          </span>
        ) : (
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
            {handoff.routing?.destinationType ?? handoff.action}
          </span>
        )}
      </div>
      <p className="text-xs uppercase tracking-wide text-slate-500">Classification</p>
      <p className="text-sm text-sky-200">{handoff.classification ?? "—"}</p>
      <p className="text-xs uppercase tracking-wide text-slate-500">Spoken summary for receiving party</p>
      <p className="text-sm text-slate-200">{handoff.spokenReceiverSummary ?? "—"}</p>
      <p className="text-xs uppercase tracking-wide text-slate-500">Caller script</p>
      <p className="text-sm text-slate-300">{handoff.spokenCallerScript ?? "—"}</p>
      {handoff.premiseHazards && handoff.premiseHazards.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-amber-500">
            {officerSafetyLabel ?? "Premise hazards"}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-100">
            {handoff.premiseHazards.map((h) => (
              <li key={h.code}>
                {h.summary}
                {h.officerSafety ? ` (${officerSafetyLabel ?? "safety"})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {handoff.duplicateCadIds && handoff.duplicateCadIds.length > 0 ? (
          <span>Duplicates: {handoff.duplicateCadIds.length}</span>
        ) : null}
        {handoff.chronicLocation ? <span>Chronic location</span> : null}
        {handoff.repeatCaller ? <span>Repeat caller</span> : null}
        {handoff.ttyMode ? <span>TTY/TDD</span> : null}
        <span>Lang: {handoff.language ?? "und"}</span>
        <span>AI continues: {handoff.continueAiConversation ? "yes" : "no"}</span>
      </div>
    </div>
  );
}
