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
  pulsing: boolean;
};

let alerts: IqVisionNavAlert[] = [];
/** Incidents this client is already viewing — do not pulse for those. */
const viewingIncidentIds = new Set<string>();
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
  return {
    alerts,
    focusIncidentId,
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
 * Mark which incident this client is actively viewing (iQ Vision panel or
 * dispatcher selection). Suppresses nav pulse for that incident on this screen.
 */
export function setIqVisionViewingIncident(incidentId: string | null | undefined): void {
  viewingIncidentIds.clear();
  const id = incidentId?.trim();
  if (id) {
    viewingIncidentIds.add(id);
    // Opening the incident also clears any outstanding pulse for it.
    acknowledgeIqVisionIncident(id);
  }
}

/** Record a live-camera detection for the nav pulse. */
export function signalIqVisionNavAlert(input: {
  incidentId?: string | null;
  eventId?: string | null;
}): void {
  const incidentId = input.incidentId?.trim() || undefined;
  const eventId = input.eventId?.trim() || undefined;
  if (!incidentId && !eventId) return;
  if (incidentId && viewingIncidentIds.has(incidentId)) return;

  const next: IqVisionNavAlert = {
    incidentId,
    eventId,
    at: Date.now(),
  };
  const key = dedupeKey(next);
  alerts = [next, ...alerts.filter((a) => dedupeKey(a) !== key)].slice(0, 40);
  refreshCache();
}

/** Clear pulse for a specific incident (dispatcher opened / selected it). */
export function acknowledgeIqVisionIncident(incidentId: string | null | undefined): void {
  const id = incidentId?.trim();
  if (!id) return;
  const before = alerts.length;
  alerts = alerts.filter((a) => a.incidentId !== id);
  if (alerts.length !== before) refreshCache();
}

/** Clear scene alerts without an incident (e.g. opened iQ Vision / Camera AI). */
export function acknowledgeIqVisionSceneAlerts(): void {
  const before = alerts.length;
  alerts = alerts.filter((a) => a.incidentId);
  if (alerts.length !== before) refreshCache();
}

/** Clear all nav pulses (e.g. dispatcher clicked the pulsing iQ Vision item). */
export function clearIqVisionNavAlerts(): void {
  if (alerts.length === 0) return;
  alerts = [];
  refreshCache();
}
