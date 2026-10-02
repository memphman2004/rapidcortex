import { env } from "../../lib/env.js";
import type { RekognitionLabelInput } from "rapid-cortex-shared";

/**
 * Amazon Rekognition DetectLabels. Mock / missing SDK / failures return [] — never throw.
 */
export async function detectSceneLabels(frameBase64: string | undefined): Promise<RekognitionLabelInput[]> {
  if (!frameBase64 || env.visionAiMock) return [];
  try {
    const rekognition = (await import("@aws-sdk/client-rekognition")) as {
      RekognitionClient: new (cfg: object) => {
        send: (cmd: unknown) => Promise<{
          Labels?: Array<{ Name?: string; Confidence?: number; Instances?: unknown[] }>;
        }>;
      };
      DetectLabelsCommand: new (input: object) => unknown;
    };
    const client = new rekognition.RekognitionClient({});
    const out = await client.send(
      new rekognition.DetectLabelsCommand({
        Image: { Bytes: Buffer.from(frameBase64, "base64") },
        MaxLabels: 20,
        MinConfidence: 55,
      }),
    );
    return (out.Labels ?? [])
      .map((label) => ({
        name: label.Name ?? "",
        confidence: label.Confidence ?? 0,
        instances: label.Instances?.length ?? 1,
      }))
      .filter((label) => label.name);
  } catch (err) {
    console.error(JSON.stringify({ msg: "vision_scene_rekognition_failed", error: String(err) }));
    return [];
  }
}
