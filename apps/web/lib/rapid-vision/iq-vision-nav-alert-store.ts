/**
 * Client-side alert state for the iQ Vision left-nav pulse.
 * Each dispatcher receives the same agency WebSocket events; acknowledging
 * an incident clears the pulse on that client's screen.
 */

export type IqVisionNavAlert = {
  /** Incident that produced the detection, when known. */
  incidentId?: string;
  /** Scene-intel event id when there is no incident yet. */
  eventId?: string;
  at: number;
};

type Snapshot = {
  alerts: IqVisionNavAlert[];
  /** Newest incident id with an active alert (for deep-link). */
  focusIncidentId: string | null;
  focusEventId: string | null;
  criticalCount: number;
  pulsing: boolean;
};

let alerts: IqVisionNavAlert[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function dedupeKey(a: IqVisionNavAlert): string {
  if (a.incidentId) return `inc:${a.incidentId}`;
  if (a.eventId) return `evt:${a.eventId}`;
  return `t:${a.at}`;
}

function snapshot(): Snapshot {
  const focusIncidentId =
    [...alerts].reverse().find((a) => a.incidentId)?.incidentId ?? null;
  const focusEventId = [...alerts].reverse().find((a) => a.eventId)?.eventId ?? null;
  return {
    alerts,
    focusIncidentId,
    focusEventId,
    criticalCount: alerts.length,
    pulsing: alerts.length > 0,
  };
}

let cached: Snapshot = snapshot();

function refreshCache() {
  cached = snapshot();
  emit();
}

export function getIqVisionNavAlertSnapshot(): Snapshot {
  return cached;
}

export function subscribeIqVisionNavAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Remember which incident this screen is showing.
 * Viewing does not acknowledge an alert and does not stop the sidebar pulse.
 */
export function setIqVisionViewingIncident(_incidentId: string | null | undefined): void {
  /* Viewing an incident does not acknowledge a Scene Intelligence alert. */
}

/** Record a live-camera detection for the nav pulse. */
export function signalIqVisionNavAlert(input: {
  incidentId?: string | null;
  eventId?: string | null;
}): void {
  const incidentId = input.incidentId?.trim() || undefined;
  const eventId = input.eventId?.trim() || undefined;
  if (!incidentId && !eventId) return;

  const next: IqVisionNavAlert = {
    incidentId,
    eventId,
    at: Date.now(),
  };
  const key = dedupeKey(next);
  alerts = [next, ...alerts.filter((a) => dedupeKey(a) !== key)].slice(0, 40);
  refreshCache();
}

/** Stop the pulse for one scene alert after an explicit acknowledgment. */
export function acknowledgeIqVisionEvent(eventId: string | null | undefined): void {
  const id = eventId?.trim();
  if (!id) return;
  const before = alerts.length;
  alerts = alerts.filter((a) => a.eventId !== id);
  if (alerts.length !== before) refreshCache();
}

/** Stop the pulse for alerts tied to this incident after an explicit acknowledgment. */
export function acknowledgeIqVisionIncident(incidentId: string | null | undefined): void {
  const id = incidentId?.trim();
  if (!id) return;
  const before = alerts.length;
  alerts = alerts.filter((a) => a.incidentId !== id);
  if (alerts.length !== before) refreshCache();
}

/** Clear scene-only pulses after an explicit acknowledgment, not because the page opened. */
export function acknowledgeIqVisionSceneAlerts(): void {
  const before = alerts.length;
  alerts = alerts.filter((a) => a.incidentId);
  if (alerts.length !== before) refreshCache();
}

/** Clear every nav pulse. Used by tests and an explicit acknowledge-all. */
export function clearIqVisionNavAlerts(): void {
  if (alerts.length === 0) return;
  alerts = [];
  refreshCache();
}
