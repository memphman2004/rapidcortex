"use client";

import { useEffect, useState } from "react";
import { isRingEnabled } from "./ring-feature-flags";
import type { RingDevicesResponse } from "./ring-types";

type ConnectionState = "loading" | "connected" | "disconnected" | "error";

export function RingIntegrationStatus({ agencyId: _agencyId, userId: _userId }: { agencyId: string; userId: string }) {
  const [state, setState] = useState<ConnectionState>("loading");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isRingEnabled()) return;
    const run = async () => {
      setState("loading");
      try {
        const res = await fetch("/api/integrations/ring/devices", { credentials: "include" });
        if (res.status === 404) {
          if (active) setState("disconnected");
          return;
        }
        const body = (await res.json()) as RingDevicesResponse;
        if (!res.ok || !body.success) {
          if (active) setState("error");
          return;
        }
        const devices = body.data?.devices ?? [];
        if (active) {
          setCount(devices.length);
          setState(devices.length > 0 ? "connected" : "disconnected");
        }
      } catch {
        if (active) setState("error");
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  if (!isRingEnabled()) return null;

  const dotClass =
    state === "connected"
      ? "bg-emerald-500"
      : state === "error"
        ? "bg-rose-500"
        : state === "loading"
          ? "animate-pulse bg-slate-500"
          : "bg-slate-500";
  const label =
    state === "loading"
      ? "Checking Ring connection..."
      : state === "connected"
        ? "Ring Connected"
        : state === "error"
          ? "Ring Auth Error"
          : "Ring Not Connected";
  const hint =
    state === "connected"
      ? `${count} devices linked`
      : state === "error"
        ? "Reconnect required →"
        : "";

  return (
    <div className="flex items-center justify-between rounded-md border border-[#2A3A4A] bg-[#1E2A3A] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className="text-sm text-[#F0F4F8]">{label}</span>
      </div>
      {hint ? <span className="text-xs text-[#8B9CB0]">{hint}</span> : null}
    </div>
  );
}
