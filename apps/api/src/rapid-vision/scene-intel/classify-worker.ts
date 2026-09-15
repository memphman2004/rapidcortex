import { randomUUID } from "node:crypto";
import type { SQSHandler } from "aws-lambda";
import type { RecognitionLabel, VisionCamera, VisionSceneAlert } from "rapid-cortex-shared";
import {
  classifyRekognitionLabels,
  SCENE_INTEL_COOLDOWN_SECONDS_DEFAULT,
  sceneAlertTtlEpoch,
  type RekognitionLabelInput,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";
import { visionStore } from "../store.js";

const auditRepo = new AuditRepository();

export type SceneClassifyMessage = {
  agencyId: string;
  cameraId: string;
  cameraName?: string;
  zoneLabel?: string;
  frameS3Key?: string;
  mockLabels?: RekognitionLabelInput[];
};

export async function persistSceneAlert(alert: VisionSceneAlert): Promise<void> {
  await visionStore.putSceneAlert(alert);
  if (env.enableVisionAiWs) {
    await broadcastToAgency({
      agencyId: alert.agencyId,
      message: { type: "rapid-vision.scene.alert", data: { alert } },
    });
  }
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: alert.agencyId,
      actorId: "system:vision-scene-classify",
      type: AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_CREATED,
      details: {
        eventId: alert.eventId,
        cameraId: alert.cameraId,
        eventType: alert.eventType,
        severity: alert.severity,
      },
      createdAt: new Date().toISOString(),
      resourceType: "vision_scene_alert",
      resourceId: alert.eventId,
    });
  } catch (err) {
    console.warn(JSON.stringify({ msg: "vision_scene_alert_audit_failed", error: String(err) }));
  }
}

function toRecognitionLabels(labels: RekognitionLabelInput[]): RecognitionLabel[] {
  return labels.map((l) => ({
    name: l.name,
    confidence: l.confidence,
    instances: l.instances ?? 1,
  }));
}

export async function classifyAndPersist(message: SceneClassifyMessage): Promise<VisionSceneAlert | null> {
  if (!env.enableRapidVision || !env.enableRapidVisionSceneIntel) return null;
  if (!message.agencyId || !message.cameraId) return null;

  const settings = await visionStore.getSettings(message.agencyId);
  if (settings.sceneIntelEnabled === false) return null;

  const camera = await visionStore.getCamera(message.agencyId, message.cameraId);
  const cooldown =
    camera?.sceneCooldownSeconds ?? SCENE_INTEL_COOLDOWN_SECONDS_DEFAULT;
  const latest = await visionStore.latestSceneAlertForCamera(message.agencyId, message.cameraId);
  if (latest?.status === "active") {
    const ageSec = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;
    if (ageSec < cooldown) return null;
  }

  const labels = message.mockLabels ?? [];
  const classified = classifyRekognitionLabels(labels);
  if (!classified) return null;

  const min = settings.sceneIntelMinSeverity ?? "low";
  const rank: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  if ((rank[classified.severity] ?? 0) < (rank[min] ?? 0)) return null;

  const now = new Date().toISOString();
  const alert: VisionSceneAlert = {
    eventId: randomUUID(),
    agencyId: message.agencyId,
    cameraId: message.cameraId,
    cameraName: message.cameraName ?? camera?.friendlyName ?? message.cameraId,
    zoneLabel: message.zoneLabel ?? camera?.zoneLabel ?? "",
    timestamp: now,
    eventType: classified.eventType,
    category: classified.category,
    severity: classified.severity,
    status: "active",
    shortLabel: classified.shortLabel,
    narrative: "",
    confidence: classified.confidence,
    detectionLabels: toRecognitionLabels(labels),
    thumbnailS3Key: env.enableVisionAiThumbnails ? message.frameS3Key : undefined,
    ttl: sceneAlertTtlEpoch(settings.retentionDays || 30),
  };
  await persistSceneAlert(alert);
  return alert;
}

export function cameraToClassifyMessage(camera: VisionCamera, mockLabels: RekognitionLabelInput[]): SceneClassifyMessage {
  return {
    agencyId: camera.agencyId,
    cameraId: camera.cameraId,
    cameraName: camera.friendlyName,
    zoneLabel: camera.zoneLabel,
    mockLabels,
  };
}

export const handler: SQSHandler = async (event) => {
  if (!env.enableRapidVisionSceneIntel) return;
  for (const record of event.Records ?? []) {
    try {
      const message = JSON.parse(record.body) as SceneClassifyMessage;
      await classifyAndPersist(message);
    } catch (err) {
      console.error(JSON.stringify({ msg: "vision_scene_classify_record_failed", error: String(err) }));
    }
  }
};
