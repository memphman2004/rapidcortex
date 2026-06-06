import { z } from "zod";

/** Kinesis Video stream ingested from WebRTC when channel media storage is configured. */
export const liveVideoStorageModeSchema = z.enum(["off", "kvs-ingestion"]);
export type LiveVideoStorageMode = z.infer<typeof liveVideoStorageModeSchema>;

export const kvsChannelRoleModeSchema = z.enum(["caller-master-dispatcher-viewer", "dispatcher-master-caller-viewer"]);
export type KvsChannelRoleMode = z.infer<typeof kvsChannelRoleModeSchema>;

export const storageModeConfigSchema = z
  .object({
    /** Effective mode for the session (env default or per-request override). */
    mode: liveVideoStorageModeSchema,
    /** When true in deployment, API may call UpdateMediaStorageConfiguration (changes WebRTC behavior per AWS). */
    attachChannelToStream: z.boolean().optional(),
  })
  .strict();
export type StorageModeConfig = z.infer<typeof storageModeConfigSchema>;

export const recordedPlaybackStatusSchema = z.enum(["not_available", "processing", "ready", "error"]);
export type RecordedPlaybackStatus = z.infer<typeof recordedPlaybackStatusSchema>;

export const recordedPlaybackResponseSchema = z.object({
  sessionId: z.string(),
  incidentId: z.string(),
  status: recordedPlaybackStatusSchema,
  storageMode: liveVideoStorageModeSchema,
  kinesisVideoStreamArn: z.string().optional(),
  kinesisVideoStreamName: z.string().optional(),
  /** Short-lived HLS master URL from Kinesis Video Archived Media (treat as sensitive). */
  hlsPlaybackUrl: z.string().url().optional(),
  hlsUrlExpiresAt: z.string().optional(),
  message: z.string().optional(),
});
export type RecordedPlaybackResponse = z.infer<typeof recordedPlaybackResponseSchema>;
