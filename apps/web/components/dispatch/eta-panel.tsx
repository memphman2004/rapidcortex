"use client";

import { useState } from "react";

export function EtaPanel({
  lastKnownEtaMinutes,
  lastEtaNotifiedAt,
  onSceneAt,
  notificationCount,
  busy,
  onSendEta,
}: {
  lastKnownEtaMinutes?: number;
  lastEtaNotifiedAt?: string;
  onSceneAt?: string;
  notificationCount: number;
  busy?: boolean;
  onSendEta: (etaMinutes: number) => void;
}) {
  const [etaMinutes, setEtaMinutes] = useState(
    typeof lastKnownEtaMinutes === "number" ? String(lastKnownEtaMinutes) : "5",
  );

  return (
    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ETA notify</p>
        <span className="text-[10px] text-slate-500">{notificationCount} sent</span>
      </div>
      {onSceneAt ? (
        <p className="text-xs text-emerald-300">On scene · {new Date(onSceneAt).toLocaleTimeString()}</p>
      ) : (
        <p className="text-xs text-slate-400">
          Last ETA:{" "}
          {typeof lastKnownEtaMinutes === "number" ? `${lastKnownEtaMinutes} min` : "—"}
          {lastEtaNotifiedAt ? ` · notified ${new Date(lastEtaNotifiedAt).toLocaleTimeString()}` : ""}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={240}
          value={etaMinutes}
          onChange={(e) => setEtaMinutes(e.target.value)}
          className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          aria-label="ETA minutes"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const n = Number(etaMinutes);
            if (!Number.isFinite(n) || n < 0) return;
            onSendEta(n);
          }}
          className="rounded bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send ETA SMS"}
        </button>
      </div>
    </div>
  );
}
