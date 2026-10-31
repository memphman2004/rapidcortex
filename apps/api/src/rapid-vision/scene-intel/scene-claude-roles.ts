import type { VisionSceneAlert } from "rapid-cortex-shared";
import { completeClaudeMessage } from "../claude-vision.js";

/**
 * Scene Intelligence Claude roles.
 * Rekognition still makes the first visual pass. These models do not replace it,
 * do not create incidents, and do not change live camera thresholds by themselves.
 *
 * Haiku 5.5  — alert readout and false-positive filter
 * Sonnet 5.5 — annotation review (newer than claude-sonnet-4-6)
 * Opus 5.5   — weekly pattern notes for a person to accept
 */
export const SCENE_CLAUDE_MODELS = {
  alertFilter: process.env.SCENE_CLAUDE_ALERT_MODEL?.trim() || "claude-haiku-5-5",
  annotationReview: process.env.SCENE_CLAUDE_ANNOTATION_MODEL?.trim() || "claude-sonnet-5-5",
  weeklyPatterns: process.env.SCENE_CLAUDE_WEEKLY_MODEL?.trim() || "claude-opus-5-5",
} as const;

const FILTER_SYSTEM = [
  "You filter one Amazon Rekognition scene alert for a public-safety watch desk.",
  "Describe only the labels you are given. Do not invent a weapon, a crime, or a person's identity.",
  "A firearm-like label is not proof a firearm is present.",
  "Return JSON only: {\"keep\":true|false,\"readout\":\"one sentence\",\"reason\":\"short\"}.",
  "keep is false for likely false positives: tools, sports, dancing, parked cars, a single unclear shape.",
  "The readout must say the observation is unverified.",
].join(" ");

export type SceneAlertFilter = {
  keep: boolean;
  readout: string;
  reason: string;
};

export function parseSceneAlertFilter(raw: string): SceneAlertFilter | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      keep?: unknown;
      readout?: unknown;
      reason?: unknown;
    };
    if (typeof parsed.keep !== "boolean") return null;
    const readout = typeof parsed.readout === "string" ? parsed.readout.trim() : "";
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : "";
    if (!readout) return null;
    return { keep: parsed.keep, readout, reason };
  } catch {
    return null;
  }
}

export async function filterSceneAlert(input: {
  alert: Pick<VisionSceneAlert, "shortLabel" | "eventType" | "cameraName" | "zoneLabel" | "detectionLabels">;
  frameBase64?: string;
}): Promise<SceneAlertFilter | null> {
  const labels = input.alert.detectionLabels
    .map((label) => `${label.name} ${Math.round(label.confidence)}`)
    .join(", ");
  const raw = await completeClaudeMessage({
    model: SCENE_CLAUDE_MODELS.alertFilter,
    system: FILTER_SYSTEM,
    maxTokens: 220,
    imageBase64: input.frameBase64,
    userText: [
      `Camera: ${input.alert.cameraName}`,
      `Zone: ${input.alert.zoneLabel || "unspecified"}`,
      `Rekognition class hint: ${input.alert.shortLabel} (${input.alert.eventType})`,
      `Labels: ${labels || "none"}`,
    ].join("\n"),
  });
  return raw ? parseSceneAlertFilter(raw) : null;
}

export type AnnotationReview = {
  accept: boolean;
  notes: string;
};

export function parseAnnotationReview(raw: string): AnnotationReview | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { accept?: unknown; notes?: unknown };
    if (typeof parsed.accept !== "boolean") return null;
    const notes = typeof parsed.notes === "string" ? parsed.notes.trim() : "";
    if (!notes) return null;
    return { accept: parsed.accept, notes };
  } catch {
    return null;
  }
}

/** Reviews a human annotation. It does not look at a live camera and does not approve a model. */
export async function reviewSceneAnnotation(input: {
  category: string;
  notes: string;
  negativeExample: boolean;
}): Promise<AnnotationReview | null> {
  const raw = await completeClaudeMessage({
    model: SCENE_CLAUDE_MODELS.annotationReview,
    system: [
      "You review one training annotation for a public-safety camera model.",
      "Accept only when the note describes a visible object or activity, not a person's identity, clothing as suspicion, or a crime.",
      "A negative example is valid when it names a harmless lookalike.",
      "Return JSON only: {\"accept\":true|false,\"notes\":\"what the reviewer should fix or why it is usable\"}.",
    ].join(" "),
    maxTokens: 300,
    userText: `Category: ${input.category}\nNegative example: ${input.negativeExample ? "yes" : "no"}\nAnnotator note: ${input.notes}`,
  });
  return raw ? parseAnnotationReview(raw) : null;
}

export type WeeklyPatternNote = {
  summary: string;
  thresholdNote: string;
};

export function parseWeeklyPatternNote(raw: string): WeeklyPatternNote | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      summary?: unknown;
      thresholdNote?: unknown;
    };
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const thresholdNote = typeof parsed.thresholdNote === "string" ? parsed.thresholdNote.trim() : "";
    if (!summary || !thresholdNote) return null;
    return { summary, thresholdNote };
  } catch {
    return null;
  }
}

/** Recommendation only. The caller must not write camera thresholds from this result. */
export async function summarizeSceneWeek(
  rows: Array<Pick<VisionSceneAlert, "eventType" | "status" | "dismissReason" | "shortLabel">>,
): Promise<WeeklyPatternNote | null> {
  const counts = new Map<string, number>();
  let dismissed = 0;
  for (const row of rows) {
    counts.set(row.eventType, (counts.get(row.eventType) ?? 0) + 1);
    if (row.status === "dismissed" && row.dismissReason === "false_positive") dismissed += 1;
  }
  const tally = [...counts.entries()].map(([eventType, count]) => `${eventType}:${count}`).join(", ");
  const raw = await completeClaudeMessage({
    model: SCENE_CLAUDE_MODELS.weeklyPatterns,
    system: [
      "You review counts of unverified camera alerts for one agency.",
      "Suggest whether a person should raise or lower a review threshold.",
      "Do not declare that a crime occurred. Do not say a model is approved.",
      "Return JSON only: {\"summary\":\"one sentence\",\"thresholdNote\":\"one sentence a person must confirm before any change\"}.",
    ].join(" "),
    maxTokens: 280,
    userText: `Alerts: ${rows.length}. False-positive dismissals: ${dismissed}. Counts: ${tally || "none"}.`,
  });
  return raw ? parseWeeklyPatternNote(raw) : null;
}
