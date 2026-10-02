import {
  CreateStreamCommand,
  DescribeSignalingChannelCommand,
  DescribeStreamCommand,
  GetDataEndpointCommand,
  KinesisVideoClient,
  UpdateDataRetentionCommand,
  UpdateMediaStorageConfigurationCommand,
} from "@aws-sdk/client-kinesis-video";
import {
  GetClipCommand,
  GetHLSStreamingSessionURLCommand,
  KinesisVideoArchivedMediaClient,
  ListFragmentsCommand,
} from "@aws-sdk/client-kinesis-video-archived-media";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { VideoClip, VideoFragment, VideoRetentionHours } from "rapid-cortex-shared";
import { VIDEO_HLS_URL_TTL_SECONDS, videoRecordingStreamName } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { VideoClipRepository } from "../repositories/videoClipRepository.js";

const kv = new KinesisVideoClient({ region: env.region });
const s3 = new S3Client({ region: env.region });
const lambda = new LambdaClient({ region: env.region });
const clips = new VideoClipRepository();

function isResourceInUse(error: unknown): boolean {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  return name === "ResourceInUseException";
}

function isNoFragments(error: unknown): boolean {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    name === "ResourceNotFoundException" ||
    msg.includes("no fragment") ||
    msg.includes("not found") ||
    msg.includes("no data")
  );
}

async function archivedClient(streamName: string, apiName: "GET_HLS_STREAMING_SESSION_URL" | "LIST_FRAGMENTS" | "GET_CLIP") {
  const epOut = await kv.send(
    new GetDataEndpointCommand({
      StreamName: streamName,
      APIName: apiName,
    }),
  );
  if (!epOut.DataEndpoint) throw new Error("KVS_NO_DATA_ENDPOINT");
  return new KinesisVideoArchivedMediaClient({ region: env.region, endpoint: epOut.DataEndpoint });
}

async function readClipPayloadBytes(payload: unknown): Promise<Uint8Array> {
  if (!payload) return new Uint8Array();
  if (payload instanceof Uint8Array) return payload;
  if (typeof payload === "object" && payload !== null && "transformToByteArray" in payload) {
    const fn = (payload as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray;
    if (typeof fn === "function") return fn.call(payload);
  }
  return new Uint8Array();
}

export function videoClipObjectKey(agencyId: string, clipId: string, at = new Date()): string {
  const year = String(at.getUTCFullYear());
  const month = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `video-clips/${agencyId}/${year}/${month}/${clipId}.mp4`;
}

export async function ensureRecordingStream(args: {
  agencyId: string;
  cameraId: string;
  existingStreamName?: string;
  retentionHours: VideoRetentionHours;
}): Promise<{ streamName: string; streamArn: string }> {
  const streamName = args.existingStreamName?.trim() || videoRecordingStreamName(args.agencyId, args.cameraId);
  try {
    await kv.send(
      new CreateStreamCommand({
        StreamName: streamName,
        DataRetentionInHours: args.retentionHours,
        Tags: {
          App: env.kvsWebrtcTagApp,
          Environment: env.kvsWebrtcTagEnvironment,
          Purpose: "rc-video-dvr",
        },
      }),
    );
  } catch (error) {
    if (!isResourceInUse(error)) throw error;
  }
  const described = await kv.send(new DescribeStreamCommand({ StreamName: streamName }));
  const streamArn = described.StreamInfo?.StreamARN;
  if (!streamArn) throw new Error("KVS_STREAM_NO_ARN");
  const currentRetention = described.StreamInfo?.DataRetentionInHours ?? 0;
  if (currentRetention !== args.retentionHours) {
    try {
      await kv.send(
        new UpdateDataRetentionCommand({
          StreamName: streamName,
          CurrentVersion: described.StreamInfo?.Version,
          Operation: args.retentionHours > currentRetention ? "INCREASE_DATA_RETENTION" : "DECREASE_DATA_RETENTION",
          DataRetentionChangeInHours: Math.abs(args.retentionHours - currentRetention),
        }),
      );
    } catch (error) {
      console.warn("[rapid-cortex-video] update data retention skipped", error);
    }
  }
  return { streamName, streamArn };
}

export async function maybeAttachStorageToChannel(channelName: string, streamArn: string): Promise<void> {
  if (!env.enableRcVideoAttachStorage) return;
  const described = await kv.send(new DescribeSignalingChannelCommand({ ChannelName: channelName }));
  const channelArn = described.ChannelInfo?.ChannelARN;
  if (!channelArn) return;
  await kv.send(
    new UpdateMediaStorageConfigurationCommand({
      ChannelARN: channelArn,
      MediaStorageConfiguration: {
        StreamARN: streamArn,
        Status: "ENABLED",
      },
    }),
  );
}

export async function maybeDetachStorageFromChannel(channelName: string): Promise<void> {
  if (!env.enableRcVideoAttachStorage) return;
  try {
    const described = await kv.send(new DescribeSignalingChannelCommand({ ChannelName: channelName }));
    const channelArn = described.ChannelInfo?.ChannelARN;
    if (!channelArn) return;
    await kv.send(
      new UpdateMediaStorageConfigurationCommand({
        ChannelARN: channelArn,
        MediaStorageConfiguration: { Status: "DISABLED" },
      }),
    );
  } catch (error) {
    console.warn("[rapid-cortex-video] detach media storage skipped", error);
  }
}

export async function getOnDemandHlsUrl(args: {
  streamName: string;
  start: Date;
  end: Date;
}): Promise<{ url: string; expiresAt: string }> {
  const archived = await archivedClient(args.streamName, "GET_HLS_STREAMING_SESSION_URL");
  const hls = await archived.send(
    new GetHLSStreamingSessionURLCommand({
      StreamName: args.streamName,
      PlaybackMode: "ON_DEMAND",
      HLSFragmentSelector: {
        FragmentSelectorType: "PRODUCER_TIMESTAMP",
        TimestampRange: {
          StartTimestamp: args.start,
          EndTimestamp: args.end,
        },
      },
      Expires: VIDEO_HLS_URL_TTL_SECONDS,
    }),
  );
  if (!hls.HLSStreamingSessionURL) throw new Error("KVS_NO_HLS_URL");
  return {
    url: hls.HLSStreamingSessionURL,
    expiresAt: new Date(Date.now() + VIDEO_HLS_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

export async function listRecordingFragments(args: {
  streamName: string;
  start: Date;
  end: Date;
}): Promise<VideoFragment[]> {
  const archived = await archivedClient(args.streamName, "LIST_FRAGMENTS");
  const out: VideoFragment[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < 4; page += 1) {
    const result = await archived.send(
      new ListFragmentsCommand({
        StreamName: args.streamName,
        MaxResults: 200,
        NextToken: nextToken,
        FragmentSelector: {
          FragmentSelectorType: "PRODUCER_TIMESTAMP",
          TimestampRange: {
            StartTimestamp: args.start,
            EndTimestamp: args.end,
          },
        },
      }),
    );
    for (const frag of result.Fragments ?? []) {
      if (!frag.FragmentNumber || !frag.ProducerTimestamp) continue;
      const start = frag.ProducerTimestamp;
      const end = new Date(start.getTime() + (frag.FragmentLengthInMilliseconds ?? 2000));
      out.push({
        fragmentNumber: frag.FragmentNumber,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
    }
    nextToken = result.NextToken;
    if (!nextToken) break;
  }
  return out;
}

export async function exportClipToS3(clip: VideoClip): Promise<{ ok: true; key: string; bucket: string } | { ok: false; errorCode: string }> {
  const bucket = process.env.ASSETS_BUCKET?.trim();
  if (!bucket) return { ok: false, errorCode: "ASSETS_BUCKET_MISSING" };
  const streamName = clip.kvsStreamName?.trim();
  if (!streamName) return { ok: false, errorCode: "RECORDING_NOT_ENABLED" };
  const start = new Date(clip.startTime);
  const end = new Date(clip.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { ok: false, errorCode: "INVALID_CLIP_WINDOW" };
  }
  try {
    const archived = await archivedClient(streamName, "GET_CLIP");
    const clipOut = await archived.send(
      new GetClipCommand({
        StreamName: streamName,
        ClipFragmentSelector: {
          FragmentSelectorType: "PRODUCER_TIMESTAMP",
          TimestampRange: { StartTimestamp: start, EndTimestamp: end },
        },
      }),
    );
    if (!clipOut.Payload) return { ok: false, errorCode: "KVS_EMPTY_CLIP" };
    const body = await readClipPayloadBytes(clipOut.Payload);
    if (!body.byteLength) return { ok: false, errorCode: "KVS_EMPTY_CLIP" };
    const key = videoClipObjectKey(clip.agencyId, clip.clipId);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: clipOut.ContentType || "video/mp4",
        ServerSideEncryption: "AES256",
      }),
    );
    return { ok: true, key, bucket };
  } catch (error) {
    if (isNoFragments(error)) return { ok: false, errorCode: "NO_FRAGMENTS" };
    return { ok: false, errorCode: error instanceof Error ? error.message.slice(0, 180) : "EXPORT_FAILED" };
  }
}

export async function exportPendingClip(agencyId: string, clipId: string): Promise<{ ok: boolean; errorCode?: string }> {
  const clip = await clips.get(agencyId, clipId);
  if (!clip) return { ok: false, errorCode: "NOT_FOUND" };
  await clips.updateStatus(agencyId, clipId, { status: "processing" });
  const result = await exportClipToS3(clip);
  if (!result.ok) {
    await clips.updateStatus(agencyId, clipId, { status: "error", errorMessage: result.errorCode });
    return { ok: false, errorCode: result.errorCode };
  }
  await clips.updateStatus(agencyId, clipId, {
    status: "ready",
    s3Key: result.key,
    s3Bucket: result.bucket,
    errorMessage: "",
  });
  return { ok: true };
}

export async function enqueueClipExport(agencyId: string, clipId: string): Promise<void> {
  const functionName = env.videoClipExporterFunction;
  if (!functionName) {
    await exportPendingClip(agencyId, clipId);
    return;
  }
  await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ agencyId, clipId })),
    }),
  );
}

export async function presignClipDownload(key: string): Promise<{ url: string; expiresAt: string } | null> {
  const bucket = process.env.ASSETS_BUCKET?.trim();
  if (!bucket || !key) return null;
  try {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
    return { url, expiresAt: new Date(Date.now() + 900_000).toISOString() };
  } catch {
    return null;
  }
}

export function mapHlsError(error: unknown): "NOT_FOUND" | "KVS_ERROR" {
  return isNoFragments(error) ? "NOT_FOUND" : "KVS_ERROR";
}
