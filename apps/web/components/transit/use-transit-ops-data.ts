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
import type { VenueIncidentCameraSummary } from "rapid-cortex-shared";
import { fetchVenueSectionCameras } from "@/lib/venue/venue-camera-api";
import { isTransitCamerasUiEnabled } from "@/lib/runtime-flags";
import type { VenueActiveIncidentPanel } from "@/components/venue/IncidentCameraPanel";

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
  const [activeCameraIncident, setActiveCameraIncident] = useState<VenueActiveIncidentPanel | null>(
    null,
  );

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

  const openCameraPanel = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!isTransitCamerasUiEnabled()) return;
      const incidentId = String(payload.incidentId ?? "");
      if (!incidentId) return;
      const vehicleId = String(payload.vehicleId ?? "").trim() || undefined;
      const stationId = String(payload.stationId ?? "").trim() || undefined;
      const routeId = String(payload.routeId ?? "").trim() || undefined;
      const qrRcli = String(payload.qrRcli ?? "").trim() || undefined;
      const section = String(payload.section ?? vehicleId ?? stationId ?? routeId ?? "");
      let cameras = (payload.cameras as VenueIncidentCameraSummary[] | undefined) ?? [];
      if (cameras.length === 0) {
        try {
          cameras = await fetchVenueSectionCameras(agencyId, section || "TRANSIT", 2, "transit", {
            vehicleId,
            stationId,
            routeId,
            qrRcli,
          });
        } catch {
          cameras = [];
        }
      }
      setActiveCameraIncident({
        incidentId,
        section: section || "TRANSIT",
        reportType: String(payload.reportType ?? "security"),
        location: String(payload.location ?? (section || "Transit location")),
        cameras,
        createdAt: String(payload.createdAt ?? new Date().toISOString()),
        vehicleId,
        stationId,
        routeId,
        qrRcli,
      });
    },
    [agencyId],
  );

  useAgencyWebSocket((message) => {
    if (
      message.type.startsWith("transit.") ||
      message.type === "PHYSICAL_SECURITY_EVENT" ||
      message.type === "incident:created"
    ) {
      void refresh();
    }
    if (message.type === "incident:created") {
      void openCameraPanel(message.data);
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
    activeCameraIncident,
    clearActiveCameraIncident: () => setActiveCameraIncident(null),
  };
}
