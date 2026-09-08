"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  callAssistCadReviewFields,
  callAssistCallerIdValue,
  callAssistEmergencyAlertTitle,
  callAssistFlagChips,
  callAssistIntakeRows,
  callTakerConfidenceRows,
  confidenceActionLabel,
  formatElapsedMs,
  humanizeCallAssistToken,
  mapCallAssistMonitorState,
  shortCallAssistSessionId,
  type CallAssistTransferLedgerEntry,
  type CallAssistUiProfile,
} from "rapid-cortex-shared";
import { isApiConfigured } from "@/lib/api";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  getCallAssistSession,
  getCallAssistSessionTransfers,
  postCallAssistCadPush,
  postCallAssistTransfer,
  postCallAssistTransferOutcome,
} from "@/lib/call-assist/call-assist-api";
import { isCallAssistEnabled } from "@/lib/runtime-flags";
import { CadPushBlock } from "./cad-push-block";
import { ExternalTransferDirectory } from "./external-transfer-directory";
import { CallAssistChrome, CallAssistWave } from "./call-assist-chrome";
import { CallAssistCampaignActions } from "./call-assist-campaign-actions";

type SessionDto = {
  sessionId: string;
  state: string;
  aniLast4?: string;
  language?: string;
  ttyMode?: boolean;
  createdAt?: string;
  continueAiConversation?: boolean;
  nextQuestion?: string;
  cadPushStatus?: string;
  cadIncidentId?: string;
  lastConfidence?: number;
  confidenceAction?: string;
  confidenceSource?: string;
  qaLowConfidence?: boolean;
  intentConfidence?: number;
  classificationConfidence?: number;
  locationConfidence?: number;
  routingConfidence?: number;
  cadNatureCode?: string;
  cadPriority?: 1 | 2 | 3 | 4;
  cadTypeLabel?: string;
  smsFallbackRecommended?: boolean;
  ttySmsScript?: string;
  premiseHazards?: Array<{ code?: string; summary?: string; officerSafety?: boolean }>;
  duplicateCadIds?: string[];
  chronicLocation?: boolean;
  repeatCaller?: boolean;
  knowledgeHit?: boolean;
  bargeInCount?: number;
  intake?: {
    locationText?: string;
    apartmentSuite?: string;
    crossStreets?: string;
    directionOfTravel?: string;
    incidentTypeHint?: string;
    injuries?: boolean;
    injuriesDetail?: string;
    weaponsMentioned?: boolean;
    weaponsDetail?: string;
    vehicleYear?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehiclePlate?: string;
    suspectDescription?: string;
    callbackNumber?: string;
    callerName?: string;
    language?: string;
    preferredLanguage?: string;
    addressConfidence?: number;
    zoneId?: string;
    zoneName?: string;
    jurisdictionMatch?: boolean;
    jurisdictionLabel?: string;
    summary?: string;
    locationSource?: string;
  };
  triage?: { primaryClassification?: string; confidence?: number };
  rmsDraftStatus?: string;
  rmsReportNumber?: string;
  callback?: { status?: string; phoneE164?: string; lastError?: string; attempts?: unknown[] };
  smsSelfService?: { status?: string; portalUrl?: string; lastError?: string };
  lastTransferOutcome?: string;
  sentiment?: { label?: string; scores?: { negative?: number }; source?: string };
  voiceEmotion?: { label?: string; distressLevel?: string; escalateToEmergency?: boolean; source?: string };
  utterances?: Array<{ sequence: number; speaker: string; text: string; speakerId?: string }>;
};

type HandoffDto = {
  action?: string;
  spokenReceiverSummary?: string;
  transcriptSummary?: string;
  premiseHazards?: Array<{ code?: string; summary?: string; officerSafety?: boolean }>;
  chronicLocation?: boolean;
  repeatCaller?: boolean;
  ttyMode?: boolean;
  language?: string;
};

export function CallAssistSessionDetail({ sessionId }: { sessionId: string }) {
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const { config: profile, requestAgencyId, agencyId, ready } = useCallAssistConfig();
  const enabled = Boolean(sessionId && isApiConfigured() && isCallAssistEnabled() && ready);
  const [acked, setAcked] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["call-assist-session", sessionId, agencyId],
    queryFn: () => getCallAssistSession(sessionId, requestAgencyId),
    refetchInterval: 3000,
    enabled,
  });
  const transfersQuery = useQuery({
    queryKey: ["call-assist-session-transfers", sessionId, agencyId],
    queryFn: () => getCallAssistSessionTransfers(sessionId, requestAgencyId),
    refetchInterval: 5000,
    enabled,
  });

  const session = sessionQuery.data?.session as SessionDto | undefined;
  const handoff = (sessionQuery.data?.handoff ?? null) as HandoffDto | null;
  const mapped = session ? mapCallAssistMonitorState(session.state) : "ai_active";
  const isTr = mapped === "transfer_911";
  const isAi = mapped === "ai_active";

  const takeOver = useMutation({
    mutationFn: () => postCallAssistTransfer(sessionId, { reason: "Operator takeover", destinationType: "CALL_TAKER" }, requestAgencyId),
    onSuccess: () => {
      setActionMsg("Takeover recorded. AI conversation stopped.");
      void qc.invalidateQueries({ queryKey: ["call-assist-session", sessionId] });
    },
    onError: (err) => setActionMsg(err instanceof Error ? err.message : "Takeover failed"),
  });

  const cadPush = useMutation({
    mutationFn: () => postCallAssistCadPush(sessionId, requestAgencyId),
    onSuccess: (data) => {
      const reason = data.result?.reason ?? (data.result?.blocked ? "blocked" : "submitted");
      setActionMsg(data.result?.blocked ? `CAD push blocked: ${reason}` : `CAD push: ${reason}`);
      void qc.invalidateQueries({ queryKey: ["call-assist-session", sessionId] });
    },
    onError: (err) => setActionMsg(err instanceof Error ? err.message : "CAD push failed"),
  });

  const extTransfer = useMutation({
    mutationFn: (name: string) =>
      postCallAssistTransfer(sessionId, {
        reason: `Warm transfer requested to ${name}`,
        destinationType: "EXTERNAL_AGENCY",
      }, requestAgencyId),
    onSuccess: () => {
      setActionMsg("Transfer requested. Outbound telephony is queued when the voice path is connected.");
      void qc.invalidateQueries({ queryKey: ["call-assist-session", sessionId] });
    },
    onError: (err) => setActionMsg(err instanceof Error ? err.message : "Transfer failed"),
  });

  const transferOutcome = useMutation({
    mutationFn: (outcome: "ANSWERED" | "FAILED" | "NO_ANSWER" | "FALLBACK" | "COMPLETED") =>
      postCallAssistTransferOutcome(sessionId, { outcome }, requestAgencyId),
    onSuccess: (_data, outcome) => {
      setActionMsg(`Transfer outcome recorded: ${outcome}.`);
      void qc.invalidateQueries({ queryKey: ["call-assist-session", sessionId] });
      void qc.invalidateQueries({ queryKey: ["call-assist-session-transfers", sessionId] });
    },
    onError: (err) => setActionMsg(err instanceof Error ? err.message : "Outcome update failed"),
  });

  const elapsed = useMemo(() => {
    const created = session?.createdAt ? Date.parse(session.createdAt) : NaN;
    if (!Number.isFinite(created)) return "—";
    return formatElapsedMs(Date.now() - created);
  }, [session?.createdAt, sessionQuery.dataUpdatedAt]);

  if (!isCallAssistEnabled()) {
    return <p className="p-6 text-sm text-slate-400">Call Assist is not enabled.</p>;
  }

  return (
    <div className="p-4 md:p-6">
      <CallAssistChrome title={`Session #${shortCallAssistSessionId(sessionId)}`} />
      <Link href={to("/call-assist")} className="mb-3 inline-flex text-[12px] text-sky-400 hover:text-slate-100">
        ← Call Assist
      </Link>
      {!session || !profile ? (
        <p className="mt-4 text-sm text-slate-500">{sessionQuery.isLoading ? "Loading session…" : "Session not found."}</p>
      ) : (
        <SessionBody
          profile={profile}
          session={session}
          handoff={handoff}
          isTr={isTr}
          isAi={isAi}
          acked={acked}
          setAcked={setAcked}
          elapsed={elapsed}
          actionMsg={actionMsg}
          onTakeOver={() => takeOver.mutate()}
          takeOverPending={takeOver.isPending}
          onCadPush={() => cadPush.mutate()}
          cadPending={cadPush.isPending}
          onExternal={(name) => extTransfer.mutate(name)}
          extPending={extTransfer.isPending}
          transfers={transfersQuery.data?.items ?? []}
          onTransferOutcome={(outcome) => transferOutcome.mutate(outcome)}
          outcomePending={transferOutcome.isPending}
          agencyId={requestAgencyId}
          onCampaignMsg={(m) => {
            setActionMsg(m);
            void qc.invalidateQueries({ queryKey: ["call-assist-session", sessionId] });
          }}
        />
      )}
    </div>
  );
}

function SessionBody({
  profile,
  session,
  handoff,
  isTr,
  isAi,
  acked,
  setAcked,
  elapsed,
  actionMsg,
  onTakeOver,
  takeOverPending,
  onCadPush,
  cadPending,
  onExternal,
  extPending,
  transfers,
  onTransferOutcome,
  outcomePending,
  agencyId,
  onCampaignMsg,
}: {
  profile: CallAssistUiProfile;
  session: SessionDto;
  handoff: HandoffDto | null;
  isTr: boolean;
  isAi: boolean;
  acked: boolean;
  setAcked: (v: boolean) => void;
  elapsed: string;
  actionMsg: string | null;
  onTakeOver: () => void;
  takeOverPending: boolean;
  onCadPush: () => void;
  cadPending: boolean;
  onExternal: (name: string) => void;
  extPending: boolean;
  transfers: CallAssistTransferLedgerEntry[];
  onTransferOutcome: (outcome: "ANSWERED" | "FAILED" | "NO_ANSWER" | "FALLBACK" | "COMPLETED") => void;
  outcomePending: boolean;
  agencyId?: string | null;
  onCampaignMsg: (msg: string) => void;
}) {
  const classification = session.triage?.primaryClassification;
  const type =
    profile.classificationLabels?.[classification ?? ""] ||
    session.intake?.incidentTypeHint?.trim() ||
    humanizeCallAssistToken(classification);
  const loc = session.intake?.locationText?.trim() || "—";
  const cid = callAssistCallerIdValue(profile.vertical, session);
  const summary =
    handoff?.spokenReceiverSummary ||
    session.intake?.summary ||
    handoff?.transcriptSummary ||
    "";
  const cadFields = callAssistCadReviewFields({
    classification,
    natureCode: session.cadNatureCode ?? (classification ? profile.cadNatureMapping[classification] : undefined),
    taxonomyLabel: session.cadTypeLabel,
    priority: session.cadPriority,
    location: session.intake?.locationText,
    callerId: cid,
    callerIdLabel: profile.callerIdLabel,
    locationLabel: profile.locationLabel,
  });
  const intakeRows = callAssistIntakeRows(profile.vertical, session.intake, classification);
  const flags = callAssistFlagChips({
    vertical: profile.vertical,
    premiseHazards: handoff?.premiseHazards ?? session.premiseHazards,
    chronicLocation: handoff?.chronicLocation ?? session.chronicLocation,
    repeatCaller: handoff?.repeatCaller ?? session.repeatCaller,
    ttyMode: handoff?.ttyMode ?? session.ttyMode,
    language: handoff?.language ?? session.language ?? session.intake?.preferredLanguage ?? session.intake?.language,
    duplicateCount: session.duplicateCadIds?.length,
    smsFallbackRecommended: session.smsFallbackRecommended,
  });
  const confidenceRows = callTakerConfidenceRows({
    intentScore: session.intentConfidence ?? session.lastConfidence ?? session.triage?.confidence,
    classificationScore: session.classificationConfidence ?? session.triage?.confidence,
    addressConfidence: session.locationConfidence ?? session.intake?.addressConfidence,
    locationSource: session.intake?.locationSource,
    locationText: session.intake?.locationText,
    routingDestinationType: undefined,
    classification,
  });
  const alertTitle = callAssistEmergencyAlertTitle(profile.vertical, profile.alertPickupLine);
  const showCad = Boolean(profile.cadProvider);
  const showDir = Boolean(isTr && !profile.cadProvider);

  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100">{type}</h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {loc} · {profile.callerIdLabel} {cid} · Session #{shortCallAssistSessionId(session.sessionId)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${isTr ? "bg-rose-500/15 text-rose-300" : "bg-sky-500/15 text-sky-400"}`}>
            {isTr ? profile.escalationLabel : "AI handling"}
          </span>
          {session.lastConfidence != null || session.triage?.confidence != null ? (
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-mono ${
                session.qaLowConfidence || session.confidenceAction === "escalate_human"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              NLU {(session.lastConfidence ?? session.triage?.confidence ?? 0).toFixed(2)}
            </span>
          ) : null}
          {session.knowledgeHit === false ? (
            <span className="rounded px-2 py-0.5 text-[11px] text-amber-300">Ungrounded</span>
          ) : null}
          {session.sentiment?.label ? (
            <span
              className={`rounded px-2 py-0.5 text-[11px] ${
                session.sentiment.label === "NEGATIVE" ? "bg-amber-500/15 text-amber-300" : "bg-slate-800 text-slate-300"
              }`}
            >
              Sentiment {session.sentiment.label.toLowerCase()}
            </span>
          ) : null}
          {session.voiceEmotion?.label ? (
            <span
              className={`rounded px-2 py-0.5 text-[11px] ${
                session.voiceEmotion.escalateToEmergency || session.voiceEmotion.distressLevel === "CRITICAL"
                  ? "bg-rose-500/15 text-rose-300"
                  : session.voiceEmotion.distressLevel === "HIGH"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-slate-800 text-slate-300"
              }`}
            >
              {session.voiceEmotion.label.toLowerCase()}
              {session.voiceEmotion.distressLevel && session.voiceEmotion.distressLevel !== "NONE"
                ? ` · ${session.voiceEmotion.distressLevel.toLowerCase()}`
                : ""}
            </span>
          ) : null}
          {session.lastTransferOutcome ? (
            <span className="rounded px-2 py-0.5 text-[11px] text-slate-300">
              Transfer {session.lastTransferOutcome.replaceAll("_", " ").toLowerCase()}
            </span>
          ) : null}
          <span className="font-mono text-[13px] text-slate-400">{elapsed}</span>
        </div>
      </div>

      {isTr && !acked ? (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-400" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-rose-300">{alertTitle}</p>
            <p className="mt-0.5 text-[11px] text-rose-300/70">{profile.alertSub}</p>
          </div>
          <button
            type="button"
            className="ml-auto shrink-0 rounded border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-[11px] font-medium text-rose-300"
            onClick={() => setAcked(true)}
          >
            Acknowledge
          </button>
        </div>
      ) : null}

      {isAi ? (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-2">
          <CallAssistWave />
          <span className="text-[12px] font-medium text-sky-400">AI is speaking</span>
          {session.nextQuestion ? (
            <span className="text-[11px] text-slate-500">— {session.nextQuestion}</span>
          ) : null}
          {profile.capabilities.takeover ? (
            <button
              type="button"
              className="ml-auto rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
              onClick={onTakeOver}
              disabled={takeOverPending}
            >
              Take over call
            </button>
          ) : null}
        </div>
      ) : null}

      {isTr && summary ? (
        <div className="mb-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
          <p className="mb-1 text-[10px] font-medium text-slate-500">
            Summary — read to receiving {profile.transferTarget}
          </p>
          <p className="text-[13px] leading-relaxed text-slate-200">&ldquo;{summary}&rdquo;</p>
        </div>
      ) : null}

      {showCad && profile.cadProvider ? (
        <CadPushBlock
          cadProviderLabel={profile.cadProvider}
          fields={cadFields}
          lastStatus={session.cadPushStatus}
          cadIncidentId={session.cadIncidentId}
          canPush={profile.capabilities.cadPush && isTr}
          pending={cadPending}
          onPush={onCadPush}
        />
      ) : (
        <div className="mb-3 overflow-hidden rounded-lg border border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">Recommended CAD classification</div>
          <div className="px-3 py-2">
            {cadFields.map((f) => (
              <div key={f.k} className="flex justify-between gap-3 border-b border-slate-800 py-1.5 last:border-0">
                <span className="text-[11px] text-slate-500">{f.k}</span>
                <span className={`text-[12px] font-medium ${f.highlight ? "text-rose-300" : "text-slate-200"}`}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDir ? (
        <ExternalTransferDirectory
          transfers={profile.externalDirectory.map((e) => ({
            id: e.externalAgencyId,
            name: e.name,
            number: e.number,
          }))}
          canTransfer={profile.capabilities.forceTransfer}
          pending={extPending}
          onTransfer={onExternal}
        />
      ) : null}

      {actionMsg ? <p className="mb-3 text-[12px] text-amber-300">{actionMsg}</p> : null}

      {transfers.length || profile.capabilities.forceTransfer ? (
        <div className="mb-3 overflow-hidden rounded-lg border border-slate-800">
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">Transfer outcome ledger</div>
          <div className="px-3 py-2">
            {transfers.length === 0 ? (
              <p className="text-[11px] text-slate-500">No transfer attempts yet.</p>
            ) : (
              <ul className="space-y-1 text-[12px] text-slate-300">
                {transfers.map((row) => (
                  <li key={row.ledgerId} className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-1 last:border-0">
                    <span>
                      #{row.attempt} {row.destinationDisplay} · {row.channel} · {row.outcome.replaceAll("_", " ")}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {row.failureReason ?? row.fallbackTo ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {profile.capabilities.forceTransfer ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {(["ANSWERED", "NO_ANSWER", "FAILED", "FALLBACK", "COMPLETED"] as const).map((outcome) => (
                  <button
                    key={outcome}
                    type="button"
                    className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300"
                    disabled={outcomePending}
                    onClick={() => onTransferOutcome(outcome)}
                  >
                    {outcome.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <CallAssistCampaignActions session={session} agencyId={agencyId} onDone={onCampaignMsg} />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">
            Transcript
            {isAi ? <span className="text-[9px] font-semibold text-sky-400">live</span> : null}
          </div>
          <div className="space-y-3 px-3 py-3">
            {(session.utterances ?? []).map((u) => (
              <div key={u.sequence}>
                <p className={`text-[9px] font-semibold uppercase tracking-wide ${u.speaker === "assistant" || u.speaker === "system" ? "text-sky-400" : u.speaker === "other" ? "text-violet-300" : "text-slate-400"}`}>
                  {utteranceSpeakerLabel(u)}
                </p>
                <p className="text-[12px] leading-relaxed text-slate-200">{u.text}</p>
              </div>
            ))}
            {isAi && session.nextQuestion ? (
              <div>
                <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-sky-400">
                  Rapid Cortex <CallAssistWave compact />
                </p>
                <p className="text-[12px] italic text-slate-500">{session.nextQuestion}…</p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">Intake</div>
            <div className="px-3 py-2">
              {intakeRows.map((row) => (
                <div key={row.key} className="flex justify-between gap-3 border-b border-slate-800 py-1.5 last:border-0">
                  <span className="text-[11px] text-slate-500">{row.label}</span>
                  <span className={`max-w-[58%] text-right text-[12px] font-medium ${row.alert ? "text-rose-300" : "text-slate-200"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">Flags</div>
            <div className="flex flex-wrap gap-1.5 px-3 py-2">
              {flags.length === 0 ? <span className="text-[11px] text-slate-500">None</span> : null}
              {flags.map((f) => (
                <span
                  key={f.text}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    f.tone === "w"
                      ? "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                      : "border border-sky-500/20 bg-sky-500/10 text-sky-400"
                  }`}
                >
                  {f.text}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">Confidence</div>
            <div className="px-3 py-2">
              {confidenceRows.map((row) => (
                <div key={row.id} className="flex justify-between gap-3 border-b border-slate-800 py-1.5 last:border-0">
                  <span className="text-[11px] text-slate-500">{row.label}</span>
                  <span
                    className={`font-mono text-[12px] ${
                      row.action === "escalate_human"
                        ? "text-amber-300"
                        : row.action === "continue_review"
                          ? "text-sky-300"
                          : "text-slate-200"
                    }`}
                  >
                    {row.score.toFixed(2)} · {confidenceActionLabel(row.action)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {(session.duplicateCadIds?.length ?? 0) > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">Possible duplicates</div>
              <ul className="space-y-1 px-3 py-2 font-mono text-[11px] text-slate-300">
                {session.duplicateCadIds?.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {session.ttySmsScript ? (
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <div className="border-b border-slate-800 px-3 py-2 text-[11px] text-slate-400">TTY / SMS script</div>
              <p className="px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200">{session.ttySmsScript}</p>
            </div>
          ) : null}
        </div>
      </div>

      {isAi && profile.capabilities.takeover ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-[11px] font-medium text-rose-300"
            onClick={onTakeOver}
            disabled={takeOverPending}
          >
            Take over call
          </button>
        </div>
      ) : null}
    </>
  );
}

function utteranceSpeakerLabel(u: { speaker: string; speakerId?: string }): string {
  if (u.speaker === "assistant" || u.speaker === "system") return "Rapid Cortex";
  if (u.speaker === "other") return u.speakerId ? `Speaker ${u.speakerId}` : "Other speaker";
  return u.speakerId && u.speakerId !== "spk_caller" ? `Caller (${u.speakerId})` : "Caller";
}
