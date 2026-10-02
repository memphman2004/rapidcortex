import type { ScheduledHandler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { VisionCamera } from "rapid-cortex-shared";
import { SCENE_SENSITIVITY_THRESHOLD } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { visionStore } from "../store.js";
import { extractLatestFrame } from "../kvs-frame.js";
import { classifyAndPersist, type SceneClassifyMessage } from "./classify-worker.js";

const sqs = new SQSClient({});
const MAX_CONCURRENT = env.visionMaxActiveAnalysesPerAgency || 10;

const MOCK_LABELS_BY_INDEX: SceneClassifyMessage["mockLabels"][] = [
  [
    { name: "Person", confidence: 99, instances: 3 },
    { name: "Fight", confidence: 91, instances: 1 },
  ],
  [{ name: "Suspicious Vehicle", confidence: 78, instances: 1 }],
  [
    { name: "Person", confidence: 97, instances: 1 },
    { name: "Person Down", confidence: 88, instances: 1 },
  ],
];

async function enqueueOrClassify(message: SceneClassifyMessage): Promise<void> {
  // JPEG base64 can exceed SQS 256 KB — classify inline when a frame is attached.
  if (message.frameBase64 || !env.visionSceneClassifyQueueUrl) {
    await classifyAndPersist(message);
    return;
  }
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: env.visionSceneClassifyQueueUrl,
      MessageBody: JSON.stringify(message),
    }),
  );
}

async function processCamera(camera: VisionCamera, index: number): Promise<void> {
  if (camera.connectionStatus === "offline") return;
  if (camera.aiMonitoringEnabled === false) return;

  if (env.visionAiMock || camera.provider === "demo") {
    await enqueueOrClassify({
      agencyId: camera.agencyId,
      cameraId: camera.cameraId,
      cameraName: camera.friendlyName,
      zoneLabel: camera.zoneLabel,
      mockLabels: MOCK_LABELS_BY_INDEX[index % MOCK_LABELS_BY_INDEX.length],
      motionScore: 0.8,
    });
    return;
  }

  const kvsRef = camera.kvsStreamArn || camera.kvsChannelName;
  if (!kvsRef) {
    console.info(
      JSON.stringify({
        msg: "vision_scene_sampler_skip_no_kvs",
        cameraId: camera.cameraId,
        agencyId: camera.agencyId,
      }),
    );
    return;
  }

  const frameBase64 = await extractLatestFrame(kvsRef);
  if (!frameBase64) return;
  const threshold =
    SCENE_SENSITIVITY_THRESHOLD[camera.sceneSensitivity ?? "medium"] ??
    SCENE_SENSITIVITY_THRESHOLD.medium;
  // Single-frame sample: treat a successful grab as motion and let Rekognition filter.
  const motionScore = 1;
  if (motionScore < threshold) return;

  await enqueueOrClassify({
    agencyId: camera.agencyId,
    cameraId: camera.cameraId,
    cameraName: camera.friendlyName,
    zoneLabel: camera.zoneLabel,
    frameBase64,
    motionScore,
  });
}

export const handler: ScheduledHandler = async () => {
  if (!env.enableRapidVision || !env.enableRapidVisionSceneIntel) return;

  const agencyIds = env.visionSceneIntelAgencyIds;
  if (agencyIds.length === 0) return;

  const cameras: VisionCamera[] = [];
  for (const agencyId of agencyIds) {
    try {
      const listed = await visionStore.listCamerasForAgency(agencyId);
      cameras.push(...listed.filter((c) => c.aiMonitoringEnabled !== false));
    } catch (err) {
      console.error(
        JSON.stringify({ msg: "vision_scene_sampler_agency_failed", agencyId, error: String(err) }),
      );
    }
  }

  const batch = cameras.slice(0, MAX_CONCURRENT);
  await Promise.allSettled(batch.map((camera, idx) => processCamera(camera, idx)));
};
