import type { SQSHandler } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { VisionSceneAlert } from "rapid-cortex-shared";
import { mockSceneNarrative } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { parseClaudeVisionResponse, streamClaudeVision } from "../claude-vision.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";
import { visionStore } from "../store.js";

const sns = new SNSClient({});

export type SceneDescribeMessage = {
  agencyId: string;
  eventId: string;
  frameBase64?: string;
};

export async function describeAndUpdate(message: SceneDescribeMessage): Promise<VisionSceneAlert | null> {
  if (!env.enableRapidVisionSceneIntel || !env.enableVisionAiClaude) return null;
  const alert = await visionStore.getSceneAlert(message.agencyId, message.eventId);
  if (!alert || alert.agencyId !== message.agencyId) return null;

  let narrative = alert.narrative;
  if (!narrative) {
    if (env.visionAiMock || !message.frameBase64) {
      narrative = mockSceneNarrative(alert.eventType);
    } else {
      const raw = await streamClaudeVision({
        frameBase64: message.frameBase64,
        cameraName: alert.cameraName,
        context: {
          description: `Proactive camera monitoring. Zone: ${alert.zoneLabel || "unspecified"}. Event hint: ${alert.shortLabel}.`,
          recentObservationSummaries: [],
        },
        onToken: () => undefined,
      });
      narrative = raw ? parseClaudeVisionResponse(raw).narrative : mockSceneNarrative(alert.eventType);
    }
  }

  const next: VisionSceneAlert = { ...alert, narrative };
  await visionStore.putSceneAlert(next);

  if (env.enableVisionAiWs) {
    await broadcastToAgency({
      agencyId: next.agencyId,
      message: { type: "rapid-vision.scene.updated", data: { alert: next } },
    });
  }

  const settings = await visionStore.getSettings(next.agencyId);
  const pushOn =
    settings.sceneIntelSupervisorPushEnabled !== false &&
    (next.severity === "critical" || next.severity === "high");
  const topic = env.visionSceneSupervisorTopicArn;
  if (pushOn && topic) {
    try {
      await sns.send(
        new PublishCommand({
          TopicArn: topic,
          Subject: `Rapid Vision ${next.severity.toUpperCase()}: ${next.shortLabel}`,
          Message: JSON.stringify({
            agencyId: next.agencyId,
            eventId: next.eventId,
            cameraName: next.cameraName,
            severity: next.severity,
            narrative: next.narrative,
          }),
        }),
      );
    } catch (err) {
      console.warn(JSON.stringify({ msg: "vision_scene_supervisor_sns_failed", error: String(err) }));
    }
  }

  return next;
}

export const handler: SQSHandler = async (event) => {
  if (!env.enableRapidVisionSceneIntel) return;
  for (const record of event.Records ?? []) {
    try {
      const message = JSON.parse(record.body) as SceneDescribeMessage;
      await describeAndUpdate(message);
    } catch (err) {
      console.error(JSON.stringify({ msg: "vision_scene_describe_failed", error: String(err) }));
    }
  }
};
