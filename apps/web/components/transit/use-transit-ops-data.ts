"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  TransitAlertLevel,
  TransitAlertState,
  TransitDashboardStats,
  TransitIncident,
  TransitIncidentCreateBody,
  TransitOperator,
  TransitReport,
  TransitRoute,
  TransitStation,
  TransitVehicle,
} from "rapid-cortex-shared";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";

export type TransitOpsPayload = {
  stats: TransitDashboardStats;
  vehicles: TransitVehicle[];
  incidents: TransitIncident[];
  operators: TransitOperator[];
  routes: TransitRoute[];
  stations: TransitStation[];
  reports: TransitReport[];
  alert: TransitAlertState;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

export function useTransitOpsData(agencyId: string) {
  const [data, setData] = useState<TransitOpsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    try {
      const res = await fetch(`/api/transit/${encodeURIComponent(agencyId)}/dashboard`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await parseJson<TransitOpsPayload>(res);
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transit ops");
    } finally {
      setIsLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useAgencyWebSocket((message) => {
    if (message.type.startsWith("transit.")) {
      void refresh();
    }
  });

  const createIncident = useCallback(
    async (body: TransitIncidentCreateBody) => {
      const res = await fetch(`/api/transit/${encodeURIComponent(agencyId)}/incidents`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      await parseJson(res);
      await refresh();
    },
    [agencyId, refresh],
  );

  const patchIncident = useCallback(
    async (incidentId: string, body: { status?: string; escalatedTo911?: boolean }) => {
      const res = await fetch(
        `/api/transit/${encodeURIComponent(agencyId)}/incidents/${encodeURIComponent(incidentId)}`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      await parseJson(res);
      await refresh();
    },
    [agencyId, refresh],
  );

  const setAlertLevel = useCallback(
    async (level: TransitAlertLevel) => {
      const res = await fetch(`/api/transit/${encodeURIComponent(agencyId)}/alert-level`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level }),
      });
      await parseJson(res);
      await refresh();
    },
    [agencyId, refresh],
  );

  const broadcast = useCallback(
    async (message: string) => {
      const res = await fetch(`/api/transit/${encodeURIComponent(agencyId)}/broadcast`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, audience: "all_operators" }),
      });
      await parseJson(res);
      await refresh();
    },
    [agencyId, refresh],
  );

  return {
    data,
    isLoading,
    error,
    refresh,
    createIncident,
    patchIncident,
    setAlertLevel,
    broadcast,
  };
}
