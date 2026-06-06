"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RingLinkedDevicesPanel } from "./RingLinkedDevicesPanel";
import { isRingEnabled } from "./ring-feature-flags";
import type { RingDevicesResponse } from "./ring-types";

type State = "loading" | "not_linked" | "linked" | "error";
type Toast = { tone: "ok" | "err"; text: string } | null;

export function RingConnectButton({
  agencyId,
  userId,
  onLinked,
}: {
  agencyId: string;
  userId: string;
  onLinked?: () => void;
}) {
  const [state, setState] = useState<State>("loading");
  const [deviceCount, setDeviceCount] = useState(0);
  const [toast, setToast] = useState<Toast>(null);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!isRingEnabled()) return;
    const qp = new URLSearchParams(window.location.search);
    const status = qp.get("status");
    if (status === "success") setToast({ tone: "ok", text: "Ring account connected." });
    if (status === "error") setToast({ tone: "err", text: "Ring account connection failed." });
    if (status) {
      qp.delete("status");
      const next = `${window.location.pathname}${qp.toString() ? `?${qp.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/integrations/ring/devices", { credentials: "include" });
      if (res.status === 404) {
        setState("not_linked");
        return;
      }
      const body = (await res.json()) as RingDevicesResponse;
      if (!res.ok || !body.success) {
        setState("error");
        return;
      }
      const count = body.data?.devices?.length ?? 0;
      setDeviceCount(count);
      setState(count > 0 ? "linked" : "not_linked");
      if (count > 0) onLinked?.();
    } catch {
      setState("error");
    }
  }, [onLinked]);

  useEffect(() => {
    if (!isRingEnabled()) return;
    void load();
  }, [load]);

  const action = useMemo(() => {
    if (state === "loading") return "Checking...";
    if (state === "error") return "Reconnect Ring Account";
    if (state === "linked") return "Manage devices →";
    return "Connect Ring Account";
  }, [state]);

  if (!isRingEnabled()) return null;

  return (
    <div className="rounded-lg border border-[#2A3A4A] bg-[#1E2A3A] p-4">
      {toast ? (
        <p className={`mb-3 text-sm ${toast.tone === "ok" ? "text-emerald-300" : "text-rose-300"}`}>{toast.text}</p>
      ) : null}
      {state === "linked" ? (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-sm text-[#22C55E]">
            <CheckCircle2 size={16} />
            Ring Account Connected
          </p>
          <p className="text-xs text-[#8B9CB0]">{deviceCount} devices linked</p>
          <button
            type="button"
            className="text-sm text-sky-300 underline"
            onClick={() => setShowPanel(true)}
          >
            {action}
          </button>
        </div>
      ) : state === "error" ? (
        <div className="space-y-2">
          <p className="inline-flex items-center gap-2 text-sm text-[#FF4444]">
            <AlertTriangle size={16} />
            Ring Auth Error — Reconnect Required
          </p>
          <button
            type="button"
            className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white"
            onClick={() => {
              window.location.href = "/api/integrations/ring/login";
            }}
          >
            {action}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            disabled={state === "loading"}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            onClick={() => {
              window.location.href = "/api/integrations/ring/login";
            }}
          >
            {action}
          </button>
          <p className="text-xs text-[#8B9CB0]">Link your Ring account for emergency collaboration.</p>
        </div>
      )}

      {showPanel ? <RingLinkedDevicesPanel agencyId={agencyId} userId={userId} onClose={() => setShowPanel(false)} /> : null}
    </div>
  );
}
