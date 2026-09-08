"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@/components/auth/session-context";
import { canFileCallAssistRms, canTakeOverCallAssistCallback, canViewCallAssist } from "@/lib/call-assist/access";
import {
  postCallAssistCallbackDecision,
  postCallAssistCallbackOffer,
  postCallAssistCallbackTakeover,
  postCallAssistRmsFile,
  postCallAssistSmsSelfService,
} from "@/lib/call-assist/call-assist-api";

type SessionCampaign = {
  sessionId: string;
  state: string;
  callback?: { status?: string; phoneE164?: string; lastError?: string; attempts?: unknown[] };
  smsSelfService?: { status?: string; portalUrl?: string; lastError?: string };
  rmsDraftStatus?: string;
  rmsReportNumber?: string;
  intake?: { callbackNumber?: string };
};

export function CallAssistCampaignActions({
  session,
  agencyId,
  onDone,
}: {
  session: SessionCampaign;
  agencyId?: string | null;
  onDone: (msg: string) => void;
}) {
  const { user } = useSession();
  const [phone, setPhone] = useState(session.intake?.callbackNumber ?? "");
  const canView = canViewCallAssist(user?.role);
  const canTakeover = canTakeOverCallAssistCallback(user?.role);
  const canRms = canFileCallAssistRms(user?.role);

  const offer = useMutation({
    mutationFn: () => postCallAssistCallbackOffer(session.sessionId, phone || undefined, agencyId),
    onSuccess: () => onDone("Callback offered."),
    onError: (err) => onDone(err instanceof Error ? err.message : "Callback offer failed"),
  });
  const decide = useMutation({
    mutationFn: (accept: boolean) => postCallAssistCallbackDecision(session.sessionId, accept, agencyId),
    onSuccess: (_d, accept) => onDone(accept ? "Callback queued." : "Callback declined."),
    onError: (err) => onDone(err instanceof Error ? err.message : "Callback decision failed"),
  });
  const takeover = useMutation({
    mutationFn: () => postCallAssistCallbackTakeover(session.sessionId, agencyId),
    onSuccess: () => onDone("Dispatcher took over this callback."),
    onError: (err) => onDone(err instanceof Error ? err.message : "Takeover failed"),
  });
  const sms = useMutation({
    mutationFn: () => postCallAssistSmsSelfService(session.sessionId, phone || undefined, agencyId),
    onSuccess: () => onDone("Self-service SMS sent."),
    onError: (err) => onDone(err instanceof Error ? err.message : "SMS send failed"),
  });
  const rms = useMutation({
    mutationFn: () => postCallAssistRmsFile(session.sessionId, undefined, agencyId),
    onSuccess: (data) =>
      onDone(
        data.result?.blocked
          ? `RMS blocked: ${data.result.reason}`
          : `RMS: ${data.result?.reason ?? "filed"} ${data.result?.reportNumber ?? ""}`,
      ),
    onError: (err) => onDone(err instanceof Error ? err.message : "RMS file failed"),
  });

  if (!canView) return null;

  return (
    <section className="mb-3 rounded-lg border border-slate-800 p-3">
      <h3 className="mb-2 text-[11px] font-semibold text-slate-400">Callback / SMS / RMS</h3>
      <p className="mb-2 text-[11px] text-slate-500">
        Callback: {session.callback?.status ?? "none"}
        {session.callback?.lastError ? ` (${session.callback.lastError})` : ""} · SMS:{" "}
        {session.smsSelfService?.status ?? "none"} · RMS: {session.rmsDraftStatus ?? "not filed"}
        {session.rmsReportNumber ? ` #${session.rmsReportNumber}` : ""}
      </p>
      <label className="mb-2 block text-[11px] text-slate-500">
        Callback / SMS number
        <input
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] text-slate-100"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+18165550100"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
          disabled={offer.isPending}
          onClick={() => offer.mutate()}
        >
          Offer callback
        </button>
        {session.state === "CALLBACK_OFFERED" ? (
          <>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
              onClick={() => decide.mutate(true)}
            >
              Queue callback
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
              onClick={() => decide.mutate(false)}
            >
              Decline callback
            </button>
          </>
        ) : null}
        {canTakeover && session.callback ? (
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
            disabled={takeover.isPending}
            onClick={() => takeover.mutate()}
          >
            Take over callback
          </button>
        ) : null}
        <button
          type="button"
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
          disabled={sms.isPending}
          onClick={() => sms.mutate()}
        >
          Send SMS self-service
        </button>
        {canRms ? (
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
            disabled={rms.isPending}
            onClick={() => rms.mutate()}
          >
            File to RMS
          </button>
        ) : null}
      </div>
    </section>
  );
}
