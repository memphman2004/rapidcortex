"use client";

import { useCallback, useEffect } from "react";
import type { VisionSceneAlert, VisionWebSocketEvent } from "rapid-cortex-shared";
import { useOptionalSession } from "@/components/auth/session-context";
import { useAgencyWebSocket, type AgencyWebSocketMessage } from "@/hooks/use-agency-websocket";
import { isRapidVisionEnabled } from "@/lib/runtime-flags";
import { acknowledgeIqVisionEvent, clearIqVisionNavAlerts, signalIqVisionNavAlert } from "@/lib/rapid-vision/iq-vision-nav-alert-store";
import { isSceneAlertWatchDesk } from "@/lib/rapid-vision/scene-alert-audience";
import {
  isSceneAlertAcknowledged,
  listSyntheticSceneAlerts,
  subscribeSceneReview,
} from "@/lib/rapid-vision/scene-review-store";

function asVisionEvent(message: AgencyWebSocketMessage): VisionWebSocketEvent | null {
  if (!message.type.startsWith("rapid-vision.")) return null;
  return { type: message.type, ...(message.data ?? {}) } as VisionWebSocketEvent;
}

/**
 * Agency-wide WebSocket listener: pulse iQ Vision in the left nav when a live
 * critical Scene Intelligence alert. Mounted from the dispatch and dashboard shells.
 */
function pulseFor(alert: Pick<VisionSceneAlert, "eventId" | "incidentId" | "severity" | "status">) {
  if (alert.severity !== "critical" || alert.status !== "active") return;
  if (isSceneAlertAcknowledged(alert.eventId)) {
    acknowledgeIqVisionEvent(alert.eventId);
    return;
  }
  signalIqVisionNavAlert({ incidentId: alert.incidentId, eventId: alert.eventId });
}

export function IqVisionNavAlertListener() {
  const enabled = isRapidVisionEnabled();
  const session = useOptionalSession();
  const watchDesk = isSceneAlertWatchDesk(session?.user?.role);

  const onWs = useCallback((message: AgencyWebSocketMessage) => {
    if (!watchDesk) return;
    const event = asVisionEvent(message);
    if (!event) return;
    if (event.type === "rapid-vision.scene.alert" || event.type === "rapid-vision.scene.updated") {
      pulseFor(event.alert);
    }
  }, [watchDesk]);

  useAgencyWebSocket(onWs, { enabled: enabled && watchDesk });

  useEffect(() => {
    if (!enabled) return;
    if (!watchDesk) {
      clearIqVisionNavAlerts();
      return;
    }
    const syncSynthetic = () => {
      for (const alert of listSyntheticSceneAlerts()) {
        if (alert.review === "acknowledged") acknowledgeIqVisionEvent(alert.eventId);
        else signalIqVisionNavAlert({ eventId: alert.eventId });
      }
    };
    syncSynthetic();
    return subscribeSceneReview(syncSynthetic);
  }, [enabled, watchDesk]);

  useEffect(() => {
    if (!enabled || !watchDesk) return;
    let cancelled = false;
    const reconcile = async () => {
      try {
        const res = await fetch("/api/vision/events?status=active&limit=50", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { data?: { alerts?: VisionSceneAlert[] } };
        for (const alert of body.data?.alerts ?? []) pulseFor(alert);
      } catch {
        /* The WebSocket path still delivers alerts that are already connected. */
      }
    };
    void reconcile();
    const timer = window.setInterval(() => void reconcile(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, watchDesk]);

  return null;
}
