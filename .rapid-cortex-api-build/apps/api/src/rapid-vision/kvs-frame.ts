import { execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import {
  KinesisVideoClient,
  GetDataEndpointCommand,
  APIName,
} from "@aws-sdk/client-kinesis-video";
import {
  KinesisVideoArchivedMediaClient,
  GetHLSStreamingSessionURLCommand,
} from "@aws-sdk/client-kinesis-video-archived-media";
import { env } from "../lib/env.js";

const kv = new KinesisVideoClient({});

/**
 * Latest JPEG as base64. Mock returns a stub. KVS/ffmpeg failures return null — never throw.
 */
export async function extractLatestFrame(streamNameOrArn: string): Promise<string | null> {
  if (env.visionAiMock) return Buffer.from("mock-frame").toString("base64");

  try {
    const endpoint = await kv.send(
      new GetDataEndpointCommand({
        StreamName: streamNameOrArn.startsWith("arn:") ? undefined : streamNameOrArn,
        StreamARN: streamNameOrArn.startsWith("arn:") ? streamNameOrArn : undefined,
        APIName: APIName.GET_HLS_STREAMING_SESSION_URL,
      }),
    );
    if (!endpoint.DataEndpoint) return null;

    const archivedClient = new KinesisVideoArchivedMediaClient({ endpoint: endpoint.DataEndpoint });
    const hlsResult = await archivedClient.send(
      new GetHLSStreamingSessionURLCommand({
        StreamName: streamNameOrArn.startsWith("arn:") ? undefined : streamNameOrArn,
        StreamARN: streamNameOrArn.startsWith("arn:") ? streamNameOrArn : undefined,
        PlaybackMode: "LIVE",
        Expires: 60,
        HLSFragmentSelector: { FragmentSelectorType: "SERVER_TIMESTAMP" },
      }),
    );
    if (!hlsResult.HLSStreamingSessionURL) return null;

    const outputPath = `/tmp/rv-frame-${Date.now()}.jpg`;
    try {
      execSync(
        `/opt/bin/ffmpeg -y -i "${hlsResult.HLSStreamingSessionURL}" -vframes 1 -q:v 3 -vf "scale=1280:-1" ${outputPath} 2>/dev/null`,
        { timeout: 20_000 },
      );
      if (!existsSync(outputPath)) return null;
      return readFileSync(outputPath).toString("base64");
    } finally {
      try {
        if (existsSync(outputPath)) unlinkSync(outputPath);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    console.error(JSON.stringify({ msg: "vision_kvs_frame_failed", error: String(err) }));
    return null;
  }
}
