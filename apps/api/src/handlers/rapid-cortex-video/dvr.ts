import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  VIDEO_CLIP_TTL_SECONDS,
  assertClipWindow,
  videoClipCreateBodySchema,
  videoRecordingPatchBodySchema,
  type VideoApiErrorCode,
  type VideoCameraRetentionPolicy,
  type VideoClip,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  notFound,
  ok,
  serviceUnavailable,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { VideoClipRepository } from "../../repositories/videoClipRepository.js";
import {
  enqueueClipExport,
  ensureRecordingStream,
  getOnDemandHlsUrl,
  listRecordingFragments,
  mapHlsError,
  maybeAttachStorageToChannel,
  maybeDetachStorageFromChannel,
  presignClipDownload,
} from "../../services/videoDvrService.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import { getAgencyCamera, updateCameraRecording } from "./camera-lookup.js";

const auditRepo = new AuditRepository();
const clipRepo = new VideoClipRepository();

function videoError(code: VideoApiErrorCode, error: string, statusCode: number) {
  return jsonStatus({ error, code }, statusCode);
}

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function parseTimestamp(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defaultWindow(): { start: Date; end: Date } {
  const end = new Date();
  return { start: new Date(end.getTime() - 60 * 60 * 1000), end };
}

function recordingStreamFor(camera: {
  retentionPolicy?: VideoCameraRetentionPolicy;
  kvsStreamName?: string;
  cameraId: string;
}): string | null {
  if (!camera.retentionPolicy?.enabled) return null;
  return camera.kvsStreamName?.trim() || null;
}

async function auditSafe(input: Parameters<AuditRepository["create"]>[0]): Promise<void> {
  try {
    await auditRepo.create(input);
  } catch (error) {
    console.warn("[rapid-cortex-video] audit skipped", error);
  }
}

function decodeCursor(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function encodeCursor(key: Record<string, unknown> | undefined): string | undefined {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

async function withDownloadUrl(clip: VideoClip, includeUrl: boolean): Promise<VideoClip> {
  if (!includeUrl || clip.status !== "ready" || !clip.s3Key) return clip;
  const signed = await presignClipDownload(clip.s3Key);
  if (!signed) return clip;
  return { ...clip, downloadUrl: signed.url };
}

/**
 * Phase 2 DVR routes under `/api/video/{agencyId}/...`.
 * Returns null when the path is not a DVR route.
 */
export async function handleVideoDvr(
  event: APIGatewayProxyEventV2,
  parts: string[],
  method: string,
): Promise<APIGatewayProxyResultV2 | null> {
  const qs = event.queryStringParameters ?? {};

  if (parts[0] === "cameras" && parts[2] === "playback-session" && parts.length === 3 && method === "GET") {
    const ctx = await requireAgencyRoute(event, "video.playback.view");
    if ("response" in ctx) return ctx.response;
    const camera = await getAgencyCamera(ctx.agencyId, parts[1] ?? "");
    if (!camera) return videoError("NOT_FOUND", "Camera not found", 404);
    const streamName = recordingStreamFor(camera);
    if (!streamName) {
      return videoError("RECORDING_NOT_ENABLED", "Recording is not enabled for this camera", 400);
    }
    const parsedStart = parseTimestamp(qs.startTimestamp);
    const parsedEnd = parseTimestamp(qs.endTimestamp);
    const window = parsedStart && parsedEnd && parsedEnd > parsedStart ? { start: parsedStart, end: parsedEnd } : defaultWindow();
    try {
      const hls = await getOnDemandHlsUrl({ streamName, start: window.start, end: window.end });
      await auditSafe({
        eventId: makeId("audit"),
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        type: AUDIT_EVENT_TYPES.VIDEO_PLAYBACK_OPENED,
        details: { cameraId: camera.cameraId, start: window.start.toISOString(), end: window.end.toISOString() },
        createdAt: new Date().toISOString(),
        resourceType: "video_clip",
        resourceId: camera.cameraId,
      });
      return ok({
        cameraId: camera.cameraId,
        kvsStreamName: streamName,
        hlsUrl: hls.url,
        expiresAt: hls.expiresAt,
        startTimestamp: window.start.toISOString(),
        endTimestamp: window.end.toISOString(),
      });
    } catch (error) {
      const code = mapHlsError(error);
      if (code === "NOT_FOUND") {
        return videoError("NOT_FOUND", "No recorded footage for this window", 404);
      }
      return videoError("KVS_ERROR", "Unable to create playback session", 502);
    }
  }

  if (parts[0] === "cameras" && parts[2] === "fragments" && parts.length === 3 && method === "GET") {
    const ctx = await requireAgencyRoute(event, "video.playback.view");
    if ("response" in ctx) return ctx.response;
    const camera = await getAgencyCamera(ctx.agencyId, parts[1] ?? "");
    if (!camera) return videoError("NOT_FOUND", "Camera not found", 404);
    const streamName = recordingStreamFor(camera);
    if (!streamName) {
      return videoError("RECORDING_NOT_ENABLED", "Recording is not enabled for this camera", 400);
    }
    const parsedStart = parseTimestamp(qs.startTimestamp);
    const parsedEnd = parseTimestamp(qs.endTimestamp);
    const window = parsedStart && parsedEnd && parsedEnd > parsedStart ? { start: parsedStart, end: parsedEnd } : defaultWindow();
    try {
      const fragments = await listRecordingFragments({ streamName, start: window.start, end: window.end });
      return ok({ fragments });
    } catch (error) {
      if (mapHlsError(error) === "NOT_FOUND") return ok({ fragments: [] });
      return videoError("KVS_ERROR", "Unable to list fragments", 502);
    }
  }

  if (parts[0] === "cameras" && parts[2] === "recording-status" && parts.length === 3 && method === "GET") {
    const ctx = await requireAgencyRoute(event, "video.playback.view");
    if ("response" in ctx) return ctx.response;
    const camera = await getAgencyCamera(ctx.agencyId, parts[1] ?? "");
    if (!camera) return videoError("NOT_FOUND", "Camera not found", 404);
    const policy = camera.retentionPolicy;
    return ok({
      cameraId: camera.cameraId,
      enabled: Boolean(policy?.enabled),
      retentionHours: policy?.retentionHours,
      storageClass: policy?.storageClass,
      kvsStreamName: camera.kvsStreamName,
      kvsStreamArn: camera.kvsStreamArn,
      attachStorageToChannel: env.enableRcVideoAttachStorage,
      enabledAt: policy?.enabledAt,
    });
  }

  if (parts[0] === "cameras" && parts[2] === "recording" && parts.length === 3 && method === "PUT") {
    const ctx = await requireAgencyRoute(event, "video.recording.configure");
    if ("response" in ctx) return ctx.response;
    const camera = await getAgencyCamera(ctx.agencyId, parts[1] ?? "");
    if (!camera) return videoError("NOT_FOUND", "Camera not found", 404);
    const body = parseBody(event.body);
    if (body === null) return badRequest("Invalid JSON body");
    const parsed = videoRecordingPatchBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const retentionHours = parsed.data.retentionHours ?? camera.retentionPolicy?.retentionHours ?? 72;
    const now = new Date().toISOString();
    if (parsed.data.enabled) {
      const stream = await ensureRecordingStream({
        agencyId: ctx.agencyId,
        cameraId: camera.cameraId,
        existingStreamName: camera.kvsStreamName,
        retentionHours,
      });
      try {
        await maybeAttachStorageToChannel(camera.kvsChannelName, stream.streamArn);
      } catch (error) {
        console.warn("[rapid-cortex-video] attach storage skipped", error);
      }
      const policy: VideoCameraRetentionPolicy = {
        enabled: true,
        retentionHours,
        storageClass: camera.retentionPolicy?.storageClass ?? "standard",
        enabledAt: camera.retentionPolicy?.enabledAt ?? now,
      };
      const updated = await updateCameraRecording(ctx.agencyId, camera.cameraId, {
        retentionPolicy: policy,
        kvsStreamName: stream.streamName,
        kvsStreamArn: stream.streamArn,
      });
      await auditSafe({
        eventId: makeId("audit"),
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        type: AUDIT_EVENT_TYPES.VIDEO_RECORDING_ENABLED,
        details: { cameraId: camera.cameraId, retentionHours, streamName: stream.streamName },
        createdAt: now,
        resourceType: "video_clip",
        resourceId: camera.cameraId,
      });
      return ok({
        cameraId: camera.cameraId,
        enabled: true,
        retentionHours,
        kvsStreamName: updated?.kvsStreamName ?? stream.streamName,
        kvsStreamArn: updated?.kvsStreamArn ?? stream.streamArn,
        attachStorageToChannel: env.enableRcVideoAttachStorage,
      });
    }
    await maybeDetachStorageFromChannel(camera.kvsChannelName);
    const policy: VideoCameraRetentionPolicy = {
      enabled: false,
      retentionHours,
      storageClass: camera.retentionPolicy?.storageClass ?? "standard",
      enabledAt: camera.retentionPolicy?.enabledAt,
    };
    await updateCameraRecording(ctx.agencyId, camera.cameraId, { retentionPolicy: policy });
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_RECORDING_DISABLED,
      details: { cameraId: camera.cameraId },
      createdAt: now,
      resourceType: "video_clip",
      resourceId: camera.cameraId,
    });
    return ok({ cameraId: camera.cameraId, enabled: false, retentionHours });
  }

  if (parts[0] === "cameras" && parts[2] === "clips" && parts.length === 3 && method === "POST") {
    const ctx = await requireAgencyRoute(event, "video.clips.create");
    if ("response" in ctx) return ctx.response;
    if (!env.videoClipsTable) return serviceUnavailable("Video clip storage is not configured");
    const camera = await getAgencyCamera(ctx.agencyId, parts[1] ?? "");
    if (!camera) return videoError("NOT_FOUND", "Camera not found", 404);
    const streamName = recordingStreamFor(camera);
    if (!streamName) {
      return videoError("RECORDING_NOT_ENABLED", "Recording is not enabled for this camera", 400);
    }
    const body = parseBody(event.body);
    if (body === null) return badRequest("Invalid JSON body");
    const parsed = videoClipCreateBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const window = assertClipWindow(parsed.data.startTime, parsed.data.endTime);
    if (!window.ok) {
      return videoError(
        window.code,
        window.code === "CLIP_TOO_LONG"
          ? "Clips cannot exceed 5 minutes (KVS GetClip limit)"
          : "Clips must be at least 30 seconds",
        400,
      );
    }
    const now = new Date();
    const clipId = makeId("clip");
    const clip: VideoClip = {
      clipId,
      agencyId: ctx.agencyId,
      cameraId: camera.cameraId,
      kvsChannelName: camera.kvsChannelName,
      kvsStreamName: streamName,
      displayName: parsed.data.label?.trim() || camera.displayName,
      incidentId: parsed.data.incidentId,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      durationSeconds: window.durationSeconds,
      exportedBy: ctx.user.userId,
      exportedAt: now.toISOString(),
      status: "processing",
      ttl: Math.floor(now.getTime() / 1000) + VIDEO_CLIP_TTL_SECONDS,
      locked: false,
      label: parsed.data.label,
    };
    await clipRepo.put(clip);
    try {
      await enqueueClipExport(ctx.agencyId, clipId);
    } catch (error) {
      console.warn("[rapid-cortex-video] clip export enqueue failed", error);
      await clipRepo.updateStatus(ctx.agencyId, clipId, { status: "error", errorMessage: "EXPORT_ENQUEUE_FAILED" });
    }
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_CLIP_CREATED,
      details: { clipId, cameraId: camera.cameraId, durationSeconds: window.durationSeconds },
      createdAt: clip.exportedAt,
      resourceType: "video_clip",
      resourceId: clipId,
    });
    return ok({ clip }, 202);
  }

  if (parts[0] === "clips" && parts.length === 1 && method === "GET") {
    const ctx = await requireAgencyRoute(event, "video.playback.view");
    if ("response" in ctx) return ctx.response;
    if (!env.videoClipsTable) return serviceUnavailable("Video clip storage is not configured");
    if (qs.incidentId?.trim()) {
      const clips = await clipRepo.listByIncident(ctx.agencyId, qs.incidentId);
      return ok({ clips, nextCursor: undefined });
    }
    const listed = await clipRepo.listByAgency({
      agencyId: ctx.agencyId,
      cameraId: qs.cameraId,
      limit: qs.limit ? Number(qs.limit) : 50,
      exclusiveStartKey: decodeCursor(qs.cursor),
    });
    return ok({ clips: listed.clips, nextCursor: encodeCursor(listed.lastKey) });
  }

  if (parts[0] === "clips" && parts.length === 2 && method === "GET") {
    const ctx = await requireAgencyRoute(event, "video.playback.view");
    if ("response" in ctx) return ctx.response;
    if (!env.videoClipsTable) return serviceUnavailable("Video clip storage is not configured");
    const clip = await clipRepo.get(ctx.agencyId, parts[1] ?? "");
    if (!clip) return notFound("Clip not found");
    const wantDownload = qs.download === "1" || qs.download === "true";
    if (wantDownload) {
      const exportCtx = await requireAgencyRoute(event, "video.clips.export");
      if ("response" in exportCtx) return exportCtx.response;
    }
    const withUrl = await withDownloadUrl(clip, wantDownload);
    if (wantDownload && withUrl.downloadUrl) {
      await auditSafe({
        eventId: makeId("audit"),
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        type: AUDIT_EVENT_TYPES.VIDEO_CLIP_DOWNLOADED,
        details: { clipId: clip.clipId, cameraId: clip.cameraId },
        createdAt: new Date().toISOString(),
        resourceType: "video_clip",
        resourceId: clip.clipId,
      });
    }
    return ok({ clip: withUrl });
  }

  if (parts[0] === "clips" && parts.length === 2 && method === "DELETE") {
    const ctx = await requireAgencyRoute(event, "video.clips.delete");
    if ("response" in ctx) return ctx.response;
    if (!env.videoClipsTable) return serviceUnavailable("Video clip storage is not configured");
    const result = await clipRepo.delete(ctx.agencyId, parts[1] ?? "");
    if (result === "missing") return notFound("Clip not found");
    if (result === "locked") return videoError("CLIP_LOCKED", "Locked clips cannot be deleted", 409);
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_CLIP_DELETED,
      details: { clipId: parts[1] },
      createdAt: new Date().toISOString(),
      resourceType: "video_clip",
      resourceId: parts[1] ?? "",
    });
    return ok({ deleted: true });
  }

  if (parts[0] === "clips" && parts[2] === "lock" && parts.length === 3 && method === "POST") {
    const ctx = await requireAgencyRoute(event, "video.clips.lock");
    if ("response" in ctx) return ctx.response;
    if (!env.videoClipsTable) return serviceUnavailable("Video clip storage is not configured");
    const existing = await clipRepo.get(ctx.agencyId, parts[1] ?? "");
    if (!existing) return notFound("Clip not found");
    const locked = await clipRepo.lock(ctx.agencyId, existing.clipId);
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_CLIP_LOCKED,
      details: { clipId: existing.clipId, cameraId: existing.cameraId },
      createdAt: new Date().toISOString(),
      resourceType: "video_clip",
      resourceId: existing.clipId,
    });
    return ok({ clip: locked ?? { ...existing, locked: true, ttl: undefined } });
  }

  return null;
}
