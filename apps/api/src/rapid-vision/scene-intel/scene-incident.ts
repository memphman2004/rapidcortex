import { z } from "zod";

/**
 * Preliminary iQ Vision incidents. These are internal review records.
 * Creating one does not create a CAD incident and does not dispatch responders.
 */

export const SCENE_DETECTION_CATEGORIES = [
  { id: "firearm_like", label: "Potential firearm-like object", ruleId: "weapon_like", priority: "critical" },
  { id: "blade_like", label: "Potential blade-like object", ruleId: "weapon_like", priority: "critical" },
  { id: "altercation", label: "Apparent physical altercation", ruleId: "altercation", priority: "critical" },
  { id: "person_down", label: "Possible person down or fall", ruleId: "person_down_public", priority: "high" },
  { id: "forced_entry", label: "Possible forced-entry activity", ruleId: "forced_door", priority: "critical" },
  { id: "restricted_zone", label: "Restricted-zone entry", ruleId: "restricted_entry", priority: "high" },
  { id: "vehicle_collision", label: "Possible vehicle collision", ruleId: "vehicle_collision", priority: "high" },
  { id: "obstructed_exit", label: "Obstructed emergency exit", ruleId: "obstructed_exit", priority: "critical" },
] as const;

export type SceneDetectionCategoryId = (typeof SCENE_DETECTION_CATEGORIES)[number]["id"];
export type SceneIncidentPriority = "critical" | "high" | "normal";
export type SceneIncidentStatus =
  | "UNVERIFIED"
  | "ACKNOWLEDGED"
  | "UNDER_REVIEW"
  | "HUMAN_VERIFIED"
  | "DISPATCHED"
  | "DISMISSED";

export type ActivityActor = "SCENE_INTELLIGENCE" | "SYSTEM" | "OPERATOR";

export type ActivityEntry = {
  at: string;
  actor: ActivityActor;
  text: string;
  verified: boolean;
  modelVersion?: string;
};

export type SceneIncident = {
  id: string;
  agencyId: string;
  cameraIds: string[];
  cameraName: string;
  zoneLabel: string;
  detectionCategory: SceneDetectionCategoryId;
  priority: SceneIncidentPriority;
  status: SceneIncidentStatus;
  source: "SCENE_INTELLIGENCE";
  label: "AUTOMATED DETECTION — UNVERIFIED";
  synthetic: boolean;
  modelVersion: string;
  modelApproved: false;
  detectedAt: string;
  createdAt: string;
  acknowledgedAt?: string;
  dispatchedAt?: string;
  dismissedAt?: string;
  closedAt?: string;
  assignedOperatorId?: string;
  /** Present only after a person confirms an existing CAD record. Never system-created. */
  linkedCadIncidentId?: string;
  dismissReason?: string;
  activityLog: ActivityEntry[];
  logFinalized: boolean;
  cadCreatedBySystem: false;
};

const OPEN_STATUSES = new Set<SceneIncidentStatus>([
  "UNVERIFIED",
  "ACKNOWLEDGED",
  "UNDER_REVIEW",
  "HUMAN_VERIFIED",
]);

export function isSceneIncidentOpen(status: SceneIncidentStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function categoryById(id: string) {
  return SCENE_DETECTION_CATEGORIES.find((row) => row.id === id) ?? null;
}

const detectionInputSchema = z.object({
  cameraId: z.string().trim().min(1).max(120),
  cameraName: z.string().trim().max(160).optional(),
  zoneLabel: z.string().trim().max(160).optional(),
  category: z.string().trim().min(1).max(80),
  frameCount: z.number().int().min(0).max(500),
  negativeExample: z.boolean().optional(),
  synthetic: z.boolean().optional(),
  modelApproved: z.boolean().optional(),
  modelVersion: z.string().trim().max(80).optional(),
});

export type DetectionInput = z.infer<typeof detectionInputSchema>;

export function parseDetectionInput(body: unknown) {
  return detectionInputSchema.safeParse(body);
}

export type QualifyResult =
  | { ok: false; reason: string }
  | { ok: true; category: (typeof SCENE_DETECTION_CATEGORIES)[number] };

/** A single frame, a lookalike, or an unapproved model cannot open an incident. */
export function qualifyDetection(input: {
  category: string;
  frameCount: number;
  negativeExample?: boolean;
  modelApproved?: boolean;
  synthetic?: boolean;
}): QualifyResult {
  if (input.category === "suspicious_person") {
    return { ok: false, reason: "Appearance is not a detection category." };
  }
  const category = categoryById(input.category);
  if (!category) return { ok: false, reason: "That detection category is not defined." };
  if (input.negativeExample) {
    return { ok: false, reason: "Negative example. No incident opened." };
  }
  if (input.frameCount < 2) {
    return { ok: false, reason: "A single frame is not enough to open an incident." };
  }
  if (!input.modelApproved && !input.synthetic) {
    return {
      ok: false,
      reason: "No approved detection model is connected. A labeled test is required.",
    };
  }
  if (input.modelApproved) {
    return { ok: false, reason: "No detection model has been approved for live operations." };
  }
  return { ok: true, category };
}

export function buildSceneIncident(input: {
  id: string;
  agencyId: string;
  cameraId: string;
  cameraName?: string;
  zoneLabel?: string;
  category: (typeof SCENE_DETECTION_CATEGORIES)[number];
  synthetic: boolean;
  modelVersion: string;
  now?: Date;
}): SceneIncident {
  const now = input.now ?? new Date();
  const detectedAt = new Date(now.getTime() - 7_000).toISOString();
  const similarAt = new Date(now.getTime() - 4_000).toISOString();
  const createdAt = now.toISOString();
  const version = input.modelVersion;
  return {
    id: input.id,
    agencyId: input.agencyId,
    cameraIds: [input.cameraId],
    cameraName: input.cameraName?.trim() || input.cameraId,
    zoneLabel: input.zoneLabel?.trim() || "Monitored zone",
    detectionCategory: input.category.id,
    priority: input.category.priority,
    status: "UNVERIFIED",
    source: "SCENE_INTELLIGENCE",
    label: "AUTOMATED DETECTION — UNVERIFIED",
    synthetic: input.synthetic,
    modelVersion: version,
    modelApproved: false,
    detectedAt,
    createdAt,
    activityLog: [
      {
        at: detectedAt,
        actor: "SCENE_INTELLIGENCE",
        text: `${input.category.label}. Human verification required.`,
        verified: false,
        modelVersion: version,
      },
      {
        at: similarAt,
        actor: "SCENE_INTELLIGENCE",
        text: "The same condition remains visible in subsequent frames.",
        verified: false,
        modelVersion: version,
      },
      {
        at: createdAt,
        actor: "SYSTEM",
        text: "Preliminary iQ Vision incident created. Watch-desk notification sent. No CAD incident was created.",
        verified: true,
      },
    ],
    logFinalized: false,
    cadCreatedBySystem: false,
  };
}

export type SceneIncidentAction =
  | { type: "acknowledge"; operatorId: string; at: string }
  | { type: "review"; operatorId: string; at: string }
  | { type: "verify"; operatorId: string; note: string; at: string }
  | { type: "dismiss"; operatorId: string; reason: string; at: string }
  | { type: "authorize_dispatch"; operatorId: string; linkedCadIncidentId: string; cadConfirmed: boolean; at: string }
  | { type: "note"; operatorId: string; text: string; at: string };

export function applySceneIncidentAction(
  incident: SceneIncident,
  action: SceneIncidentAction,
): { ok: true; incident: SceneIncident } | { ok: false; reason: string } {
  if (incident.logFinalized || incident.status === "DISMISSED" || incident.status === "DISPATCHED") {
    return { ok: false, reason: "The pre-dispatch activity log is finalized." };
  }
  const next: SceneIncident = {
    ...incident,
    activityLog: [...incident.activityLog],
  };

  if (action.type === "acknowledge") {
    next.status = "ACKNOWLEDGED";
    next.acknowledgedAt = action.at;
    next.assignedOperatorId = action.operatorId;
    next.activityLog.push({
      at: action.at,
      actor: "OPERATOR",
      text: "Operator accepted responsibility for review. The incident stays unverified.",
      verified: true,
    });
    return { ok: true, incident: next };
  }

  if (action.type === "review") {
    next.status = next.status === "UNVERIFIED" ? "UNDER_REVIEW" : "UNDER_REVIEW";
    next.assignedOperatorId = action.operatorId;
    next.activityLog.push({
      at: action.at,
      actor: "OPERATOR",
      text: "Live camera review initiated.",
      verified: true,
    });
    return { ok: true, incident: next };
  }

  if (action.type === "verify") {
    const note = action.note.trim();
    if (!note) return { ok: false, reason: "A verification note is required." };
    next.status = "HUMAN_VERIFIED";
    next.activityLog.push({
      at: action.at,
      actor: "OPERATOR",
      text: note,
      verified: true,
    });
    return { ok: true, incident: next };
  }

  if (action.type === "note") {
    const text = action.text.trim();
    if (!text) return { ok: false, reason: "A note is required." };
    next.activityLog.push({
      at: action.at,
      actor: "OPERATOR",
      text,
      verified: true,
    });
    return { ok: true, incident: next };
  }

  if (action.type === "dismiss") {
    const reason = action.reason.trim();
    if (!reason) return { ok: false, reason: "A dismissal reason is required." };
    next.status = "DISMISSED";
    next.dismissReason = reason;
    next.dismissedAt = action.at;
    next.closedAt = action.at;
    next.logFinalized = true;
    next.activityLog.push({
      at: action.at,
      actor: "OPERATOR",
      text: `Incident dismissed. Reason: ${reason}. The pre-dispatch log is finalized.`,
      verified: true,
    });
    return { ok: true, incident: next };
  }

  if (!action.cadConfirmed || !action.linkedCadIncidentId.trim()) {
    return {
      ok: false,
      reason: "Dispatch was not confirmed. No CAD incident was created.",
    };
  }
  next.status = "DISPATCHED";
  next.linkedCadIncidentId = action.linkedCadIncidentId.trim();
  next.dispatchedAt = action.at;
  next.closedAt = action.at;
  next.logFinalized = true;
  next.cadCreatedBySystem = false;
  next.activityLog.push({
    at: action.at,
    actor: "OPERATOR",
    text: `A person confirmed dispatch against existing CAD record ${next.linkedCadIncidentId}. NexCort iQ did not create that CAD record. The pre-dispatch log is finalized.`,
    verified: true,
  });
  return { ok: true, incident: next };
}
