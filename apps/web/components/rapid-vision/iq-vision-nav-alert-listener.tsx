"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import type { VisionWebSocketEvent } from "rapid-cortex-shared";
import { useAgencyWebSocket, type AgencyWebSocketMessage } from "@/hooks/use-agency-websocket";
import { isRapidVisionEnabled } from "@/lib/runtime-flags";
import {
  acknowledgeIqVisionSceneAlerts,
  signalIqVisionNavAlert,
} from "@/lib/rapid-vision/iq-vision-nav-alert-store";

function asVisionEvent(message: AgencyWebSocketMessage): VisionWebSocketEvent | null {
  if (!message.type.startsWith("rapid-vision.")) return null;
  return { type: message.type, ...(message.data ?? {}) } as VisionWebSocketEvent;
}

/**
 * Agency-wide WebSocket listener: pulse iQ Vision in the left nav when a live
 * camera produces an observation or scene alert. Mount once under DispatchShell.
 */
export function IqVisionNavAlertListener() {
  const pathname = usePathname() ?? "";
  const enabled = isRapidVisionEnabled();

  const onWs = useCallback((message: AgencyWebSocketMessage) => {
    const event = asVisionEvent(message);
    if (!event) return;

    if (event.type === "rapid-vision.observation.created") {
      signalIqVisionNavAlert({ incidentId: event.observation.incidentId });
      return;
    }
    if (event.type === "rapid-vision.observation.streaming.start") {
      signalIqVisionNavAlert({ incidentId: event.incidentId });
      return;
    }
    if (event.type === "rapid-vision.observation.streaming.complete") {
      signalIqVisionNavAlert({ incidentId: event.incidentId });
      return;
    }
    if (event.type === "rapid-vision.scene.alert") {
      signalIqVisionNavAlert({
        incidentId: event.alert.incidentId,
        eventId: event.alert.eventId,
      });
    }
  }, []);

  useAgencyWebSocket(onWs, { enabled });

  // Viewing the iQ Vision workspace clears scene-only (no incident) pulses.
  useEffect(() => {
    if (pathname.includes("/vision")) {
      acknowledgeIqVisionSceneAlerts();
    }
  }, [pathname]);

  return null;
}
