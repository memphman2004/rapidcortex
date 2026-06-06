"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Phone, PhoneForwarded } from "lucide-react";
import type { ActiveCallRecord } from "rapid-cortex-shared";
import {
  fetchSupervisorActiveCalls,
  isApiConfigured,
  postSupervisorTransferCall,
} from "@/lib/api";
import { isCallControlEnabled, isCallControlWebSocketEnabled } from "@/lib/runtime-flags";
import { useCallControlWebSocket } from "@/hooks/use-call-control-websocket";

export function ActiveCallsSupervisorPanel() {
  const enabled = isCallControlEnabled() && isApiConfigured();
  const wsEnabled = isCallControlWebSocketEnabled();
  const queryClient = useQueryClient();

  useCallControlWebSocket((msg) => {
    if (msg.type === "TRANSFER_STATUS" || msg.type === "CALL_TRANSFERRED") {
      queryClient.invalidateQueries({ queryKey: ["supervisor-active-calls"] });
      queryClient.invalidateQueries({ queryKey: ["dispatcher-active-calls"] });
    }
  });
  const [transferCallId, setTransferCallId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [targetUsername, setTargetUsername] = useState("");

  const q = useQuery({
    queryKey: ["supervisor-active-calls"],
    queryFn: fetchSupervisorActiveCalls,
    enabled,
    refetchInterval: wsEnabled ? false : 5000,
  });

  const transferMutation = useMutation({
    mutationFn: postSupervisorTransferCall,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisor-active-calls"] });
      queryClient.invalidateQueries({ queryKey: ["dispatcher-active-calls"] });
      setTransferCallId(null);
      setTargetUserId("");
      setTargetUsername("");
    },
  });

  if (!enabled) return null;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Active calls</h2>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Notification MVP</span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Transfer requests notify dispatchers; completion happens in CAD.
      </p>
      {q.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">No active calls tracked yet.</p>
      ) : (
        <ul className="space-y-2">
          {(q.data ?? []).map((call) => (
            <li key={call.callId} className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
              <CallRow
                call={call}
                onTransfer={() => setTransferCallId(call.callId)}
              />
            </li>
          ))}
        </ul>
      )}
      {transferCallId ? (
        <div className="mt-4 space-y-2 rounded-md border border-purple-900/40 bg-purple-950/20 p-3">
          <p className="text-xs text-purple-200">Transfer call {transferCallId}</p>
          <input
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
            placeholder="Target dispatcher user ID"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
          />
          <input
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
            placeholder="Display name (optional)"
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded bg-purple-700 px-3 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
              disabled={!targetUserId || transferMutation.isPending}
              onClick={() =>
                transferMutation.mutate({
                  callId: transferCallId,
                  targetUserId,
                  targetUsername: targetUsername || undefined,
                })
              }
            >
              {transferMutation.isPending ? "Sending…" : "Send transfer"}
            </button>
            <button
              type="button"
              className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-300"
              onClick={() => setTransferCallId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CallRow({ call, onTransfer }: { call: ActiveCallRecord; onTransfer: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-white">
          <Phone className="h-4 w-4 text-green-500" />
          {call.callerPhone}
        </p>
        <p className="text-xs text-slate-400">Handler: {call.currentHandlerUsername}</p>
        {call.pendingTransfer ? (
          <p className="mt-1 text-xs text-amber-300">
            Pending → {call.pendingTransfer.targetUsername} ({call.pendingTransfer.status})
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onTransfer}
        className="rounded bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
        title="Transfer"
      >
        <PhoneForwarded className="h-4 w-4" />
      </button>
    </div>
  );
}
