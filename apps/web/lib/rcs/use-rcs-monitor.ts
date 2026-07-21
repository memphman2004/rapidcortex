"use client";

/**
 * apps/web/lib/rcs/use-rcs-monitor.ts
 *
 * Response Continuity System (RCS) — active call list for RcsMonitorPanel /
 * RcsSupervisorStrip. Polls `/api/rcs/calls` on an interval and, when the agency
 * WebSocket is configured (`useAgencyWebSocket`), refreshes immediately on any
 * `rcs:*` push event instead of waiting for the next poll tick.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import { rcsListActiveCalls, type RcsCall } from "./rcs-api";

const DEFAULT_POLL_MS = 10_000;

export type UseRcsMonitorOptions = {
  /** Poll interval in ms (default 10s). Set to `0` to disable polling (WebSocket-only). */
  pollMs?: number;
  /** Set false to pause fetching (e.g. feature flag off, page not visible). */
  enabled?: boolean;
};

export type UseRcsMonitorResult = {
  calls: RcsCall[];
  loading: boolean;
  error: string | null;
  /** True when the agency WebSocket is connected and pushing live RCS updates. */
  live: boolean;
  refresh: () => Promise<void>;
};

export function useRcsMonitor(options: UseRcsMonitorOptions = {}): UseRcsMonitorResult {
  const { pollMs = DEFAULT_POLL_MS, enabled = true } = options;
  const [calls, setCalls] = useState<RcsCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    try {
      const items = await rcsListActiveCalls();
      setCalls(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load RCS calls");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [enabled]);

  const { connected } = useAgencyWebSocket(
    useCallback(
      (message) => {
        if (typeof message.type === "string" && message.type.startsWith("rcs:")) {
          void refresh();
        }
      },
      [refresh],
    ),
  );

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    if (pollMs <= 0) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [enabled, pollMs, refresh]);

  return { calls, loading, error, live: connected, refresh };
}
