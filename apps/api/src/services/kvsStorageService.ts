import {
  CreateStreamCommand,
  DeleteStreamCommand,
  DescribeMediaStorageConfigurationCommand,
  GetDataEndpointCommand,
  KinesisVideoClient,
  UpdateMediaStorageConfigurationCommand,
} from "@aws-sdk/client-kinesis-video";
import { GetHLSStreamingSessionURLCommand, KinesisVideoArchivedMediaClient } from "@aws-sdk/client-kinesis-video-archived-media";
import type { RecordedPlaybackResponse } from "rapid-cortex-shared";
import { env } from "../lib/env.js";

const kv = new KinesisVideoClient({ region: env.region });

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
}): Promise<RecordedPlaybackResponse> {
  if (args.storageMode === "off" || !args.streamName) {
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
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Playback error";
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
