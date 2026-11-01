import { env } from "../../lib/env.js";
import type { RekognitionLabelInput } from "rapid-cortex-shared";

type LabelHit = {
  Name?: string;
  Confidence?: number;
  Instances?: unknown[];
  Parents?: Array<{ Name?: string }>;
};

type ModerationHit = {
  Name?: string;
  Confidence?: number;
  ParentName?: string;
};

/**
 * DetectLabels plus DetectModerationLabels.
 * General labels miss fights and weapons that moderation already names.
 * Mock, a missing frame, or an SDK failure returns [] — never throw.
 */
export async function detectSceneLabels(frameBase64: string | undefined): Promise<RekognitionLabelInput[]> {
  if (!frameBase64 || env.visionAiMock) return [];
  try {
    const rekognition = (await import("@aws-sdk/client-rekognition")) as {
      RekognitionClient: new (cfg: object) => {
        send: (cmd: unknown) => Promise<{ Labels?: LabelHit[]; ModerationLabels?: ModerationHit[] }>;
      };
      DetectLabelsCommand: new (input: object) => unknown;
      DetectModerationLabelsCommand: new (input: object) => unknown;
    };
    const client = new rekognition.RekognitionClient({});
    const image = { Bytes: Buffer.from(frameBase64, "base64") };
    const [labelsOut, moderationOut] = await Promise.all([
      client.send(
        new rekognition.DetectLabelsCommand({
          Image: image,
          MaxLabels: 20,
          MinConfidence: 55,
        }),
      ),
      client
        .send(
          new rekognition.DetectModerationLabelsCommand({
            Image: image,
            MinConfidence: 60,
          }),
        )
        .catch((err: unknown) => {
          console.warn(JSON.stringify({ msg: "vision_scene_moderation_failed", error: String(err) }));
          return { ModerationLabels: [] as ModerationHit[] };
        }),
    ]);

    const labels: RekognitionLabelInput[] = (labelsOut.Labels ?? [])
      .map((label) => ({
        name: label.Name ?? "",
        confidence: label.Confidence ?? 0,
        instances: label.Instances?.length ?? 1,
        parents: (label.Parents ?? []).map((parent) => parent.Name ?? "").filter(Boolean),
      }))
      .filter((label) => label.name);

    for (const hit of moderationOut.ModerationLabels ?? []) {
      const name = hit.Name?.trim() ?? "";
      if (!name) continue;
      labels.push({
        name,
        confidence: hit.Confidence ?? 0,
        instances: 1,
        parents: hit.ParentName ? [hit.ParentName] : [],
      });
    }
    return labels;
  } catch (err) {
    console.error(JSON.stringify({ msg: "vision_scene_rekognition_failed", error: String(err) }));
    return [];
  }
}
