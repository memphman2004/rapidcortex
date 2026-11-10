"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchPinpointLinkDetail,
  fetchPinpointLinks,
  isApiConfigured,
} from "@/lib/api";
import { isPinpointEnabled } from "@/lib/runtime-flags";
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
import type { RCLiveCaller } from "@/components/maps/map-types";
import { pinpointDetailToLiveCaller } from "@/lib/live-caller";

const MAX_TRAIL = 40;

function asCoord(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Live GPS for the selected incident: Pinpoint pings (poll) plus SMS locate (WebSocket).
 */
export function useLiveCallerLocations(incidentId: string | null): RCLiveCaller[] {
  const pinpointOn = isPinpointEnabled();
  const configured = isApiConfigured();
  const [smsCaller, setSmsCaller] = useState<RCLiveCaller | null>(null);

  const persistedQ = useQuery({
    queryKey: ["caller-locations", incidentId],
    enabled: Boolean(incidentId) && configured,
    queryFn: async () => {
      const res = await fetch(`/api/incidents/${encodeURIComponent(incidentId!)}/caller-locations`, {
        credentials: "same-origin",
      });
      if (res.status === 404 || res.status === 503) return [] as Array<{
        lat: number;
        lng: number;
        accuracy: number;
        timestamp: string;
        source: string;
      }>;
      if (!res.ok) throw new Error(`caller-locations ${res.status}`);
      const body = (await res.json()) as {
        items?: Array<{ lat: number; lng: number; accuracy: number; timestamp: string; source: string }>;
      };
      return body.items ?? [];
    },
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const linksQ = useQuery({
    queryKey: ["pinpoint-links", incidentId],
    enabled: Boolean(incidentId) && configured && pinpointOn,
    queryFn: () => fetchPinpointLinks(incidentId!),
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const activeLinkId = useMemo(() => {
    const items = linksQ.data ?? [];
    const active = items.find((item) => item.status === "active");
    return active?.linkId ?? null;
  }, [linksQ.data]);

  const detailQ = useQuery({
    queryKey: ["pinpoint-link-detail", incidentId, activeLinkId],
    enabled: Boolean(incidentId && activeLinkId) && configured && pinpointOn,
    queryFn: () => fetchPinpointLinkDetail(incidentId!, activeLinkId!),
    refetchInterval: 2500,
    staleTime: 1000,
  });

  const onMessage = useCallback(
    (msg: { type: string; data: Record<string, unknown> }) => {
      if (msg.type !== "LOCATION_RECEIVED") return;
      if (!incidentId || msg.data.incidentId !== incidentId) return;
      const coords = msg.data.coordinates as
        | { latitude?: unknown; longitude?: unknown; accuracy?: unknown }
        | undefined;
      const lat = asCoord(coords?.latitude);
      const lng = asCoord(coords?.longitude);
      if (lat == null || lng == null) return;
      const sourceRaw = typeof msg.data.source === "string" ? msg.data.source : "GPS";
      if (sourceRaw === "MANUAL") return;
      const accuracy =
        asCoord(msg.data.accuracyMeters) ?? asCoord(coords?.accuracy) ?? undefined;
      const receivedAt =
        typeof msg.data.receivedAt === "string"
          ? msg.data.receivedAt
          : new Date().toISOString();
      setSmsCaller((prev) => ({
        id: `sms:${incidentId}`,
        lat,
        lng,
        updatedAt: receivedAt,
        accuracyMeters: accuracy,
        incidentId,
        source: sourceRaw === "CELL_TOWER" ? "sms" : "gps",
        trail: [...(prev?.trail ?? []), { lat, lng, at: receivedAt }].slice(-MAX_TRAIL),
        label: sourceRaw === "CELL_TOWER" ? "Cell-tower estimate" : "Caller-shared GPS",
      }));
    },
    [incidentId],
  );

  useAgencyWebSocket(onMessage, { enabled: Boolean(incidentId) });

  return useMemo(() => {
    const out: RCLiveCaller[] = [];
    if (detailQ.data) {
      const converted = pinpointDetailToLiveCaller(detailQ.data);
      if (converted) out.push(converted);
    }
    if (smsCaller && smsCaller.incidentId === incidentId) out.push(smsCaller);
    const persisted = persistedQ.data ?? [];
    if (persisted.length > 0 && incidentId) {
      const latest = persisted[0]!;
      const trail = [...persisted]
        .reverse()
        .map((p) => ({ lat: p.lat, lng: p.lng, at: p.timestamp }))
        .slice(-MAX_TRAIL);
      out.push({
        id: `track:${incidentId}`,
        lat: latest.lat,
        lng: latest.lng,
        updatedAt: latest.timestamp,
        accuracyMeters: latest.accuracy,
        incidentId,
        source: latest.source === "cell" ? "sms" : "gps",
        trail,
        label: "Caller track",
      });
    }
    return out;
  }, [detailQ.data, smsCaller, incidentId, persistedQ.data]);
}
