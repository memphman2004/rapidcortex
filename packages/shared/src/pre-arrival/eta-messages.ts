import type { EtaNotificationTrigger } from "./eta-types.js";

/**
 * Build the ETA SMS message based on trigger type and ETA in minutes.
 * Never expose unit IDs, officer names, or tactical positioning.
 */
export function buildEtaMessage(
  trigger: EtaNotificationTrigger,
  etaMinutes: number | null,
): string {
  if (trigger === "on_scene" || etaMinutes === null) {
    return "Responders are on scene. Please keep this line available if they need to reach you. You can stop texting this number.";
  }

  if (trigger === "arriving_now" || etaMinutes <= 1) {
    return "Responders are arriving RIGHT NOW. Go to the nearest door or window so they can find you quickly.";
  }

  if (trigger === "unit_dispatched") {
    return buildMinuteMessage(etaMinutes, "First responders are on the way —");
  }

  if (trigger === "eta_updated" && etaMinutes > 5) {
    return buildMinuteMessage(etaMinutes, "Update: Responders are approximately");
  }

  if (trigger === "eta_updated") {
    return buildMinuteMessage(etaMinutes, "Responders are getting closer —");
  }

  if (trigger === "dispatcher_manual") {
    return buildMinuteMessage(etaMinutes, "Dispatch update: Help is approximately");
  }

  return buildMinuteMessage(etaMinutes, "Responders are approximately");
}

function buildMinuteMessage(etaMinutes: number, prefix: string): string {
  const rounded = Math.max(1, Math.round(etaMinutes));
  const minuteWord = rounded === 1 ? "minute" : "minutes";

  if (rounded <= 2) {
    return `${prefix} ${rounded} ${minuteWord} away. Stay where you are and keep this phone close.`;
  }
  if (rounded <= 5) {
    return `${prefix} approximately ${rounded} ${minuteWord} away. Keep following the instructions and stay calm.`;
  }
  return `${prefix} approximately ${rounded} ${minuteWord} away. Continue following the guidance and stay on location.`;
}

/**
 * Prevent spamming the caller with ETA updates.
 * - Always send on_scene / arriving_now
 * - Always send first notification
 * - Min 90s between updates
 * - ETA must change by 2+ minutes unless dispatcher_manual
 */
export function shouldSendEtaNotification(params: {
  trigger: EtaNotificationTrigger;
  newEtaMinutes: number | null;
  lastKnownEtaMinutes?: number;
  lastEtaNotifiedAt?: string;
}): boolean {
  const { trigger, newEtaMinutes, lastKnownEtaMinutes, lastEtaNotifiedAt } = params;

  if (trigger === "on_scene" || trigger === "arriving_now") return true;
  if (!lastEtaNotifiedAt) return true;

  const secondsSinceLast = (Date.now() - new Date(lastEtaNotifiedAt).getTime()) / 1000;
  if (secondsSinceLast < 90) return false;

  if (trigger === "dispatcher_manual") return true;

  if (newEtaMinutes !== null && lastKnownEtaMinutes !== undefined) {
    const delta = Math.abs(lastKnownEtaMinutes - newEtaMinutes);
    if (delta < 2) return false;
  }

  return true;
}

export function classifyEtaTrigger(
  etaMinutes: number,
  isFirstNotification: boolean,
): EtaNotificationTrigger {
  if (etaMinutes <= 1) return "arriving_now";
  if (isFirstNotification) return "unit_dispatched";
  return "eta_updated";
}
