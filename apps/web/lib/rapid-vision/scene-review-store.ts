/**
 * Operator review state for Scene Intelligence alerts.
 * The alert record stays in the vision API. This store only tracks whether
 * this operator has acknowledged it, plus labeled synthetic test alerts.
 * Opening the page does not acknowledge an alert.
 */

export type SceneReviewStatus = "open" | "viewed" | "acknowledged";

export type SyntheticSceneAlert = {
  eventId: string;
  cameraId: string;
  cameraName: string;
  zoneLabel: string;
  severity: "critical";
  status: "active";
  shortLabel: string;
  narrative: string;
  timestamp: string;
  synthetic: true;
  review: SceneReviewStatus;
};

const ACK_KEY = "nexcort-iq-vision-ack";
const SYNTH_KEY = "nexcort-iq-vision-synthetic";
const listeners = new Set<() => void>();

function readIds(key: string): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(ids.slice(0, 200)));
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeSceneReview(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSceneAlertAcknowledged(eventId: string): boolean {
  return readIds(ACK_KEY).includes(eventId);
}

export function acknowledgeSceneAlert(eventId: string): void {
  const id = eventId.trim();
  if (!id || isSceneAlertAcknowledged(id)) return;
  writeIds(ACK_KEY, [id, ...readIds(ACK_KEY)]);
  const synthetic = listSyntheticSceneAlerts().map((alert) =>
    alert.eventId === id ? { ...alert, review: "acknowledged" as const } : alert,
  );
  writeSynthetic(synthetic);
  emit();
}

export function markSceneAlertViewed(eventId: string): void {
  const id = eventId.trim();
  if (!id || isSceneAlertAcknowledged(id)) return;
  const synthetic = listSyntheticSceneAlerts().map((alert) =>
    alert.eventId === id && alert.review === "open" ? { ...alert, review: "viewed" as const } : alert,
  );
  writeSynthetic(synthetic);
  emit();
}

function writeSynthetic(alerts: SyntheticSceneAlert[]) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SYNTH_KEY, JSON.stringify(alerts.slice(0, 20)));
}

export function listSyntheticSceneAlerts(): SyntheticSceneAlert[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(SYNTH_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is SyntheticSceneAlert =>
        Boolean(row) &&
        typeof row === "object" &&
        (row as SyntheticSceneAlert).synthetic === true &&
        typeof (row as SyntheticSceneAlert).eventId === "string",
    );
  } catch {
    return [];
  }
}

/** Labeled test alert. Does not create an incident or a CAD record. */
export function simulateCriticalSceneAlert(): SyntheticSceneAlert {
  const alert: SyntheticSceneAlert = {
    eventId: `scene-test-${Date.now()}`,
    cameraId: "test-camera",
    cameraName: "TEST — Camera 014",
    zoneLabel: "TEST zone",
    severity: "critical",
    status: "active",
    shortLabel: "TEST — Possible weapon-like object",
    narrative:
      "TEST alert only. This is a synthetic Scene Intelligence notification for training the sidebar pulse. It is not a live detection and it is not evidence of a weapon or a crime.",
    timestamp: new Date().toISOString(),
    synthetic: true,
    review: "open",
  };
  writeSynthetic([alert, ...listSyntheticSceneAlerts()]);
  emit();
  return alert;
}

export function unacknowledgedCriticalIds(): string[] {
  return listSyntheticSceneAlerts()
    .filter((alert) => alert.review !== "acknowledged")
    .map((alert) => alert.eventId);
}
