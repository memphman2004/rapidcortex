/**
 * NexiQ Vision™ AI Scene Intelligence — Rekognition label → dispatcher event map.
 * AI surfaces the alert; the dispatcher decides. Never auto-create an incident.
 */
import type {
  DetectionCategory,
  ObservationConfidence,
  RecognitionLabel,
  VisionSceneAlert,
  VisionSceneEventType,
  VisionSceneSeverity,
} from "./types.js";

export interface RekognitionLabelInput {
  name: string;
  confidence: number;
  instances?: number;
}

export interface SceneClassification {
  eventType: VisionSceneEventType;
  category: DetectionCategory;
  severity: VisionSceneSeverity;
  confidence: ObservationConfidence;
  shortLabel: string;
}

const LABEL = (name: string) => name.trim().toLowerCase();

function has(labels: RekognitionLabelInput[], ...names: string[]): RekognitionLabelInput | undefined {
  const want = new Set(names.map(LABEL));
  return labels.find((l) => want.has(LABEL(l.name)));
}

function personCount(labels: RekognitionLabelInput[]): number {
  const person = has(labels, "Person", "People", "Human");
  return Math.max(person?.instances ?? 0, person ? 1 : 0);
}

function confidenceBand(score: number): ObservationConfidence {
  if (score >= 85) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

/**
 * Map DetectLabels output to a dispatcher-facing event.
 * Returns null when nothing operationally relevant is in frame (motion-only).
 */
export function classifyRekognitionLabels(
  labels: RekognitionLabelInput[],
): SceneClassification | null {
  if (labels.length === 0) return null;

  const weapon = has(labels, "Weapon", "Gun", "Handgun", "Rifle", "Knife", "Firearm");
  if (weapon && (weapon.confidence ?? 0) >= 50) {
    return {
      eventType: "VISIBLE_WEAPON",
      category: "POTENTIAL_WEAPON",
      severity: "high",
      confidence: "LOW",
      shortLabel: "Possible weapon",
    };
  }

  const fight = has(labels, "Fight", "Fighting", "Violence", "Assault", "Altercation");
  if (fight || (personCount(labels) >= 2 && has(labels, "Crowd") && has(labels, "Fist"))) {
    const score = fight?.confidence ?? 70;
    return {
      eventType: "FIGHT_OR_ALTERCATION",
      category: "FIGHT_OR_ALTERCATION",
      severity: "critical",
      confidence: confidenceBand(score),
      shortLabel: "Physical altercation",
    };
  }

  const down = has(labels, "Person Down", "Lying", "Collapsed", "Unconscious");
  if (down) {
    return {
      eventType: "PERSON_DOWN",
      category: "PERSON_DOWN",
      severity: "critical",
      confidence: confidenceBand(down.confidence),
      shortLabel: "Person on ground",
    };
  }

  const medical = has(labels, "Medical", "Ambulance", "First Aid");
  if (medical && has(labels, "Person")) {
    return {
      eventType: "MEDICAL_EMERGENCY",
      category: "PERSON_DOWN",
      severity: "high",
      confidence: "LOW",
      shortLabel: "Possible medical event",
    };
  }

  const forced = has(labels, "Forced Entry", "Break In", "Tampering");
  if (forced || (has(labels, "Door") && has(labels, "Person") && has(labels, "Handle"))) {
    return {
      eventType: "FORCED_ENTRY",
      category: "RESTRICTED_AREA_ENTRY",
      severity: "high",
      confidence: confidenceBand(forced?.confidence ?? 65),
      shortLabel: "Forced entry",
    };
  }

  const collision = has(labels, "Accident", "Collision", "Crash", "Car Accident");
  if (collision && has(labels, "Car", "Vehicle", "Automobile", "Truck")) {
    return {
      eventType: "VEHICLE_COLLISION",
      category: "VEHICLE",
      severity: "high",
      confidence: confidenceBand(collision.confidence),
      shortLabel: "Vehicle collision",
    };
  }

  const suspiciousVehicle = has(labels, "Suspicious Vehicle", "Parked Vehicle");
  if (suspiciousVehicle) {
    return {
      eventType: "SUSPICIOUS_VEHICLE",
      category: "VEHICLE",
      severity: "medium",
      confidence: confidenceBand(suspiciousVehicle.confidence),
      shortLabel: "Suspicious vehicle",
    };
  }

  const shoplifting = has(labels, "Shoplifting", "Theft");
  if (shoplifting) {
    return {
      eventType: "SHOPLIFTING",
      category: "UNUSUAL_MOVEMENT",
      severity: "medium",
      confidence: "LOW",
      shortLabel: "Possible theft",
    };
  }

  const running = has(labels, "Running", "Sprinting", "Fleeing");
  if (running && has(labels, "Person")) {
    return {
      eventType: "PERSON_RUNNING",
      category: "RUNNING",
      severity: "medium",
      confidence: confidenceBand(running.confidence),
      shortLabel: "Person running",
    };
  }

  const crowd = has(labels, "Crowd", "Audience");
  if (crowd && (crowd.instances ?? 1) >= 1 && (crowd.confidence ?? 0) >= 70) {
    return {
      eventType: "CROWD_FORMATION",
      category: "CROWD_FORMATION",
      severity: crowd.confidence >= 90 ? "high" : "medium",
      confidence: confidenceBand(crowd.confidence),
      shortLabel: "Crowd forming",
    };
  }

  return null;
}

export function sceneAlertTtlEpoch(retentionDays: number, from = Date.now()): number {
  const days = Math.min(365, Math.max(1, Math.floor(retentionDays)));
  return Math.floor(from / 1000) + days * 24 * 60 * 60;
}

export const SCENE_INTEL_COOLDOWN_SECONDS_DEFAULT = 120;

/** Dispatcher-facing demo alerts matching the Scene Intelligence product spec. */
export function demoSceneAlerts(agencyId: string, now = new Date()): VisionSceneAlert[] {
  const ttl = sceneAlertTtlEpoch(30, now.getTime());
  const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();

  const base = {
    agencyId,
    status: "active" as const,
    detectionLabels: [] as RecognitionLabel[],
    ttl,
  };

  return [
    {
      ...base,
      eventId: "scene-demo-altercation",
      cameraId: "demo-device-001",
      cameraName: "5th & Main – Northeast Corner",
      zoneLabel: "Downtown District",
      timestamp: iso(1),
      eventType: "FIGHT_OR_ALTERCATION",
      category: "FIGHT_OR_ALTERCATION",
      severity: "critical",
      shortLabel: "Physical altercation",
      confidence: "HIGH",
      narrative:
        "Physical altercation between two individuals on sidewalk. Third person intervening. One subject on ground. Approximately 6 bystanders. No weapons visible. Active confrontation ongoing.",
    },
    {
      ...base,
      eventId: "scene-demo-vehicle",
      cameraId: "demo-device-002",
      cameraName: "Campus Lot C",
      zoneLabel: "Campus perimeter",
      timestamp: iso(6),
      eventType: "SUSPICIOUS_VEHICLE",
      category: "VEHICLE",
      severity: "high",
      shortLabel: "Suspicious vehicle",
      confidence: "MEDIUM",
      narrative:
        "Vehicle lingering in Lot C after hours. Occupant visible in driver seat. No other persons nearby. Lights off.",
    },
    {
      ...base,
      eventId: "scene-demo-persondown",
      cameraId: "demo-device-003",
      cameraName: "Platform B – Track 2 South End",
      zoneLabel: "Central Station",
      timestamp: iso(14),
      eventType: "PERSON_DOWN",
      category: "PERSON_DOWN",
      severity: "medium",
      shortLabel: "Person on ground",
      confidence: "MEDIUM",
      narrative:
        "Person on ground, non-responsive. Second individual crouching nearby appears to be assisting. No other persons in frame. Medical event likely.",
    },
  ];
}

export const SCENE_INTEL_EVENT_TYPE_LABELS: Record<VisionSceneEventType, string> = {
  FIGHT_OR_ALTERCATION: "Physical altercation",
  PERSON_DOWN: "Person on ground",
  CROWD_FORMATION: "Crowd forming",
  FORCED_ENTRY: "Forced entry",
  VEHICLE_COLLISION: "Vehicle collision",
  PERSON_RUNNING: "Person running",
  VISIBLE_WEAPON: "Possible weapon",
  SHOPLIFTING: "Possible theft",
  MEDICAL_EMERGENCY: "Possible medical event",
  SUSPICIOUS_VEHICLE: "Suspicious vehicle",
};

export const SCENE_SENSITIVITY_THRESHOLD: Record<"low" | "medium" | "high" | "maximum", number> = {
  low: 0.45,
  medium: 0.32,
  high: 0.2,
  maximum: 0.12,
};

export function mockSceneNarrative(eventType: VisionSceneEventType): string {
  const match = demoSceneAlerts("fixture").find((a) => a.eventType === eventType);
  if (match?.narrative) return match.narrative;
  return `${SCENE_INTEL_EVENT_TYPE_LABELS[eventType]}. Dispatcher confirmation required before any dispatch.`;
}

export function summarizeSceneAlerts(alerts: VisionSceneAlert[]) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byCamera = new Map<
    string,
    { cameraId: string; cameraName: string; count: number; dismissed: number; incidents: number }
  >();
  for (const alert of alerts) {
    bySeverity[alert.severity] += 1;
    const row = byCamera.get(alert.cameraId) ?? {
      cameraId: alert.cameraId,
      cameraName: alert.cameraName,
      count: 0,
      dismissed: 0,
      incidents: 0,
    };
    row.count += 1;
    if (alert.status === "dismissed") row.dismissed += 1;
    if (alert.status === "incident_created") row.incidents += 1;
    byCamera.set(alert.cameraId, row);
  }
  const incidentCreated = alerts.filter((a) => a.status === "incident_created").length;
  return {
    totalAlerts: alerts.length,
    activeCount: alerts.filter((a) => a.status === "active").length,
    dismissedCount: alerts.filter((a) => a.status === "dismissed").length,
    incidentCreatedCount: incidentCreated,
    conversionRate: alerts.length === 0 ? 0 : incidentCreated / alerts.length,
    bySeverity,
    byCamera: [...byCamera.values()].sort((a, b) => b.count - a.count),
  };
}
