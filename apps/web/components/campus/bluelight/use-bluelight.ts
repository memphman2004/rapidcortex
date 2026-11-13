"use client";

/**
 * Campus Blue-Light Connect — data hook.
 *
 * Fetches poles from GET /api/campus/bluelight/poles and exposes the latest
 * WS message so BlueLightPanel can filter BLUE_LIGHT_* events.
 *
 * Campus vertical only.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlueLightPole } from "rapid-cortex-shared";
import type { AgencyWebSocketMessage } from "@/hooks/use-agency-websocket";

type UseBluelightOptions = {
  agencyId: string;
  campusId: string;
  /** Pass the latest raw WS message from the campus console's existing socket. */
  lastWsMessage: AgencyWebSocketMessage | null;
  enabled: boolean;
};

type UseBluelightResult = {
  poles: BlueLightPole[];
  polesLoading: boolean;
  polesError: string | null;
};

export function useBluelight({
  agencyId: _agencyId,
  campusId,
  lastWsMessage: _lastWsMessage,
  enabled,
}: UseBluelightOptions): UseBluelightResult {
  const [poles, setPoles] = useState<BlueLightPole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchPoles = useCallback(async () => {
    if (!campusId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campus/bluelight/poles?campusId=${encodeURIComponent(campusId)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { poles: BlueLightPole[] };
      setPoles(data.poles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [campusId]);

  useEffect(() => {
    if (!enabled || fetchedRef.current) return;
    fetchedRef.current = true;
    void fetchPoles();
  }, [enabled, fetchPoles]);

  return {
    poles,
    polesLoading: loading,
    polesError: error,
  };
}
