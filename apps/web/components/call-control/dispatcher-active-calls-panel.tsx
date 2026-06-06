"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneIncoming } from "lucide-react";
import type { ActiveCallRecord } from "rapid-cortex-shared";
import {
  fetchDispatcherActiveCalls,
  isApiConfigured,
  postDispatcherAcceptTransfer,
  postDispatcherDeclineTransfer,
} from "@/lib/api";
import { isCallControlEnabled, isCallControlWebSocketEnabled } from "@/lib/runtime-flags";
import { useCallControlWebSocket } from "@/hooks/use-call-control-websocket";

export function DispatcherActiveCallsPanel() {
  const enabled = isCallControlEnabled() && isApiConfigured();
  const wsEnabled = isCallControlWebSocketEnabled();
  const queryClient = useQueryClient();

  const invalidateCalls = () => {
    queryClient.invalidateQueries({ queryKey: ["dispatcher-active-calls"] });
    queryClient.invalidateQueries({ queryKey: ["supervisor-active-calls"] });
  };

  useCallControlWebSocket((msg) => {
    if (
      msg.type === "INCOMING_TRANSFER" ||
      msg.type === "CALL_TRANSFERRED" ||
      msg.type === "TRANSFER_STATUS"
    ) {
      invalidateCalls();
    }
  });

  const q = useQuery({
    queryKey: ["dispatcher-active-calls"],
    queryFn: fetchDispatcherActiveCalls,
    enabled,
    refetchInterval: wsEnabled ? false : 5000,
  });

  const acceptMutation = useMutation({
    mutationFn: postDispatcherAcceptTransfer,
    onSuccess: invalidateCalls,
  });

  const declineMutation = useMutation({
    mutationFn: postDispatcherDeclineTransfer,
    onSuccess: invalidateCalls,
  });

  if (!enabled) return null;

  const pending = (q.data ?? []).filter((c) => c.pendingTransfer?.status === "pending");

  return (
    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <h2 className="text-sm font-semibold text-white">Call transfers</h2>
      {pending.length > 0 ? (
        <div className="space-y-2">
          {pending.map((call) => (
            <PendingTransferCard
              key={call.callId}
              call={call}
              onAccept={() => acceptMutation.mutate({ callId: call.callId })}
              onDecline={() => declineMutation.mutate({ callId: call.callId })}
              busy={acceptMutation.isPending || declineMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No incoming transfers.</p>
      )}
      {(q.data ?? []).filter((c) => !c.pendingTransfer).length > 0 ? (
        <div className="mt-2 border-t border-slate-800 pt-2">
          <p className="mb-2 text-[10px] uppercase text-slate-500">Your calls</p>
          <ul className="space-y-1 text-xs text-slate-300">
            {(q.data ?? [])
              .filter((c) => !c.pendingTransfer)
              .map((c) => (
                <li key={c.callId} className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-green-500" />
                  {c.callerPhone}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function PendingTransferCard({
  call,
  onAccept,
  onDecline,
  busy,
}: {
  call: ActiveCallRecord;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const t = call.pendingTransfer!;
  return (
    <div className="rounded-md border border-amber-800/50 bg-amber-950/20 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <PhoneIncoming className="h-4 w-4" />
        Incoming transfer
      </p>
      <p className="mt-1 text-xs text-slate-400">
        From {t.fromUsername} · {call.callerPhone}
      </p>
      <p className="mt-1 text-xs text-slate-500">Accept, then complete the transfer in your CAD system.</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="rounded bg-green-700 px-3 py-1.5 text-xs text-white hover:bg-green-600 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="rounded bg-red-900/80 px-3 py-1.5 text-xs text-white hover:bg-red-800 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
