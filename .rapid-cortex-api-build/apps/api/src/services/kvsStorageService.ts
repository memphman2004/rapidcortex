import {
  CreateStreamCommand,
  DeleteStreamCommand,
  DescribeMediaStorageConfigurationCommand,
  GetDataEndpointCommand,
  KinesisVideoClient,
  UpdateMediaStorageConfigurationCommand,
} from "@aws-sdk/client-kinesis-video";
import {
  GetClipCommand,
  GetHLSStreamingSessionURLCommand,
  KinesisVideoArchivedMediaClient,
} from "@aws-sdk/client-kinesis-video-archived-media";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { RecordedPlaybackResponse } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const kv = new KinesisVideoClient({ region: env.region });
const s3 = new S3Client({ region: env.region });
const lambda = new LambdaClient({ region: env.region });

export function liveVideoRecordingObjectKey(agencyId: string, incidentId: string, sessionId: string): string {
  return `live-video/${agencyId}/${incidentId}/${sessionId}.mp4`;
}

function normalizeStreamName(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_.-]/g, "-");
  const n = `rc-lvsv-${safe}`;
  return n.length <= 256 ? n : n.slice(0, 256);
}

/**
 * Creates a Kinesis Video **stream** (media storage) with retention for optional WebRTC ingestion recording.
 */
export async function createStorageStreamForSession(sessionId: string): Promise<{
  streamArn: string;
  streamName: string;
}> {
  const streamName = normalizeStreamName(sessionId);
  const retention = Math.max(1, env.liveVideoKvsStreamRetentionHours);
  const out = await kv.send(
    new CreateStreamCommand({
      StreamName: streamName,
      DataRetentionInHours: retention,
      Tags: {
        App: env.kvsWebrtcTagApp,
        Environment: env.kvsWebrtcTagEnvironment,
      },
    }),
  );
  if (!out.StreamARN) {
    throw new Error("KVS_STREAM_CREATE_NO_ARN");
  }
  return { streamArn: out.StreamARN, streamName };
}

/**
 * Maps the signaling channel to the video stream for WebRTC ingestion/storage.
 * When enabled, AWS requires JoinStorageSession-style clients instead of plain master/viewer on the same channel.
 */
export async function enableStorageForChannel(channelArn: string, streamArn: string): Promise<void> {
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

export async function describeChannelStorage(channelArn: string) {
  return kv.send(
    new DescribeMediaStorageConfigurationCommand({
      ChannelARN: channelArn,
    }),
  );
}

export async function deleteVideoStream(streamArn: string | undefined | null): Promise<void> {
  if (!streamArn) return;
  try {
    await kv.send(new DeleteStreamCommand({ StreamARN: streamArn }));
  } catch {
    /* best-effort */
  }
}

/**
 * Short-lived HLS URL for playback (sensitive — do not log in full).
 */
export async function getHlsPlaybackUrl(streamName: string): Promise<{ url: string; expiresAt: string }> {
  const epOut = await kv.send(
    new GetDataEndpointCommand({
      StreamName: streamName,
      APIName: "GET_HLS_STREAMING_SESSION_URL",
    }),
  );
  const endpoint = epOut.DataEndpoint;
  if (!endpoint) {
    throw new Error("KVS_NO_HLS_DATA_ENDPOINT");
  }
  const archived = new KinesisVideoArchivedMediaClient({ region: env.region, endpoint });
  const hls = await archived.send(
    new GetHLSStreamingSessionURLCommand({
      StreamName: streamName,
      PlaybackMode: "LIVE_REPLAY",
    }),
  );
  if (!hls.HLSStreamingSessionURL) {
    throw new Error("KVS_NO_HLS_URL");
  }
  const expiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString();
  return { url: hls.HLSStreamingSessionURL, expiresAt };
}

export async function getPlaybackInfo(args: {
  sessionId: string;
  incidentId: string;
  storageMode: "off" | "kvs-ingestion";
  streamName: string | undefined;
  streamArn: string | undefined;
  recordingS3Key?: string;
  recordingDownloadUrl?: string;
  recordingDownloadExpiresAt?: string;
}): Promise<RecordedPlaybackResponse> {
  const recordingFields = args.recordingS3Key
    ? {
        recordingS3Key: args.recordingS3Key,
        recordingDownloadUrl: args.recordingDownloadUrl,
        recordingDownloadExpiresAt: args.recordingDownloadExpiresAt,
      }
    : {};
  if (args.storageMode === "off" || !args.streamName) {
    if (args.recordingS3Key) {
      return {
        sessionId: args.sessionId,
        incidentId: args.incidentId,
        status: "ready",
        storageMode: "kvs-ingestion",
        message: "Recording exported from Kinesis Video Streams.",
        ...recordingFields,
      };
    }
    return {
      sessionId: args.sessionId,
      incidentId: args.incidentId,
      status: "not_available",
      storageMode: "off",
      message: "Recording / cloud storage was not enabled for this session.",
    };
  }
  try {
    const { url, expiresAt } = await getHlsPlaybackUrl(args.streamName);
    return {
      sessionId: args.sessionId,
      incidentId: args.incidentId,
      status: "ready",
      storageMode: "kvs-ingestion",
      kinesisVideoStreamArn: args.streamArn,
      kinesisVideoStreamName: args.streamName,
      hlsPlaybackUrl: url,
      hlsUrlExpiresAt: expiresAt,
      ...recordingFields,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playback error";
    if (args.recordingS3Key) {
      return {
        sessionId: args.sessionId,
        incidentId: args.incidentId,
        status: "ready",
        storageMode: "kvs-ingestion",
        kinesisVideoStreamArn: args.streamArn,
        kinesisVideoStreamName: args.streamName,
        message: "HLS from Kinesis is not ready; using exported recording.",
        ...recordingFields,
      };
    }
    if (msg.includes("ResourceNotFound") || msg.includes("not found") || msg.includes("No data")) {
      return {
        sessionId: args.sessionId,
        incidentId: args.incidentId,
        status: "processing",
        storageMode: "kvs-ingestion",
        kinesisVideoStreamArn: args.streamArn,
        kinesisVideoStreamName: args.streamName,
        message: "Recording is not ready yet, or no media was ingested to the stream.",
      };
    }
    return {
      sessionId: args.sessionId,
      incidentId: args.incidentId,
      status: "error",
      storageMode: "kvs-ingestion",
      kinesisVideoStreamArn: args.streamArn,
      kinesisVideoStreamName: args.streamName,
      message: msg,
    };
  }
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

function clipErrorCode(err: unknown): string {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  const msg = err instanceof Error ? err.message : "export failed";
  const lower = msg.toLowerCase();
  if (
    name === "ResourceNotFoundException" ||
    lower.includes("no fragment") ||
    lower.includes("resourcenotfound") ||
    lower.includes("not found")
  ) {
    return "NO_FRAGMENTS";
  }
  return "EXPORT_FAILED";
}

export async function exportSessionClipToS3(args: {
  agencyId: string;
  incidentId: string;
  sessionId: string;
  streamName: string;
  startIso: string;
  endIso: string;
}): Promise<{ ok: true; key: string } | { ok: false; errorCode: string }> {
  const bucket = process.env.ASSETS_BUCKET?.trim();
  if (!bucket) return { ok: false, errorCode: "ASSETS_BUCKET_MISSING" };
  const start = new Date(args.startIso);
  let end = new Date(args.endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, errorCode: "INVALID_CLIP_WINDOW" };
  }
  // Include trailing fragments that land just after hang-up; GetClip requires End > Start.
  if (end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 2_000);
  } else {
    end = new Date(end.getTime() + 2_000);
  }
  try {
    const epOut = await kv.send(
      new GetDataEndpointCommand({
        StreamName: args.streamName,
        APIName: "GET_CLIP",
      }),
    );
    if (!epOut.DataEndpoint) return { ok: false, errorCode: "KVS_NO_CLIP_ENDPOINT" };
    const archived = new KinesisVideoArchivedMediaClient({ region: env.region, endpoint: epOut.DataEndpoint });
    const clip = await archived.send(
      new GetClipCommand({
        StreamName: args.streamName,
        ClipFragmentSelector: {
          FragmentSelectorType: "SERVER_TIMESTAMP",
          TimestampRange: { StartTimestamp: start, EndTimestamp: end },
        },
      }),
    );
    if (!clip.Payload) return { ok: false, errorCode: "KVS_EMPTY_CLIP" };
    const body = await readClipPayloadBytes(clip.Payload);
    if (!body.byteLength) return { ok: false, errorCode: "KVS_EMPTY_CLIP" };
    const key = liveVideoRecordingObjectKey(args.agencyId, args.incidentId, args.sessionId);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: clip.ContentType || "video/mp4",
        ServerSideEncryption: "AES256",
      }),
    );
    return { ok: true, key };
  } catch (err) {
    return { ok: false, errorCode: clipErrorCode(err) };
  }
}

/** Fire-and-forget GetClip worker. No-op when LIVE_VIDEO_EXPORT_FUNCTION_NAME is unset. */
export async function enqueueRecordingExport(sessionId: string): Promise<void> {
  const functionName = process.env.LIVE_VIDEO_EXPORT_FUNCTION_NAME?.trim();
  if (!functionName || !sessionId) return;
  await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({ sessionId })),
    }),
  );
}

export async function presignRecordingDownload(key: string): Promise<{ url: string; expiresAt: string } | null> {
  const bucket = process.env.ASSETS_BUCKET?.trim();
  if (!bucket || !key) return null;
  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 900 },
    );
    return { url, expiresAt: new Date(Date.now() + 900_000).toISOString() };
  } catch {
    return null;
  }
}
