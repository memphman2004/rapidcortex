import {
  DetectLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
// Command export missing from some pinned SDK builds; load at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DetectModerationLabelsCommand = (
  require("@aws-sdk/client-rekognition") as { DetectModerationLabelsCommand?: new (input: unknown) => unknown }
).DetectModerationLabelsCommand;
import { deleteFromS3, saveMediaRecord, uploadToS3 } from "./media-store.js";
import { inferCategoryFromSceneLabels } from "./media-labels.js";
import type { MmsMediaItem, ProcessedSmsMedia, SmsMediaType } from "./types.js";

const LIMITS = {
  image: {
    maxBytes: 10 * 1024 * 1024,
    allowedTypes: new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]),
  },
  video: {
    maxBytes: 15 * 1024 * 1024,
    allowedTypes: new Set(["video/mp4", "video/quicktime", "video/3gpp", "video/3gpp2", "video/mpeg"]),
  },
  maxItemsPerMessage: 5,
};

const BLOCKED_MODERATION_CATEGORIES = new Set([
  "Explicit Nudity",
  "Nudity",
  "Graphic Male Nudity",
  "Graphic Female Nudity",
  "Sexual Activity",
  "Illustrated Explicit Nudity",
  "Adult Toys",
  "Graphic Violence or Gore",
  "Physical Violence",
  "Weapon Violence",
  "Weapons",
  "Self Injury",
  "Hate Symbols",
  "Nazi Party",
  "White Supremacy",
  "Extremist",
]);

const MODERATION_CONFIDENCE_THRESHOLD = 75;

function mediaBucket(): string {
  return process.env.CALL_ASSIST_SMS_MEDIA_BUCKET?.trim() || "";
}

function rekognitionMock(): boolean {
  const v = process.env.CALL_ASSIST_REKOGNITION_MOCK?.trim().toLowerCase();
  return v === "true" || v === "1";
}

function classifyMediaType(contentType: string): SmsMediaType {
  const ct = contentType.toLowerCase();
  if (LIMITS.image.allowedTypes.has(ct)) return "IMAGE";
  if (LIMITS.video.allowedTypes.has(ct)) return "VIDEO";
  return "UNSUPPORTED";
}

async function downloadMedia(url: string): Promise<{ buffer: Buffer; sizeBytes: number }> {
  const host = new URL(url).hostname;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`Media download failed: HTTP ${response.status} from ${host}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, sizeBytes: buffer.byteLength };
}

export function validateSmsMedia(
  mediaType: SmsMediaType,
  contentType: string,
  sizeBytes: number,
): { valid: boolean; reason?: string } {
  if (mediaType === "UNSUPPORTED") {
    return {
      valid: false,
      reason: `Unsupported file type (${contentType}). Please send JPG, PNG, GIF, or MP4.`,
    };
  }
  const limit = LIMITS[mediaType === "IMAGE" ? "image" : "video"];
  if (sizeBytes > limit.maxBytes) {
    const maxMb = (limit.maxBytes / 1024 / 1024).toFixed(0);
    if (mediaType === "VIDEO") {
      return {
        valid: false,
        reason: `Video is too large (max ${maxMb} MB, approximately 15 seconds). Please send a shorter clip.`,
      };
    }
    return { valid: false, reason: `Image is too large (max ${maxMb} MB). Please send a smaller photo.` };
  }
  return { valid: true };
}

async function moderateImage(s3Key: string): Promise<{ passed: boolean; blockedLabels: string[] }> {
  if (rekognitionMock() || !mediaBucket()) {
    return { passed: true, blockedLabels: [] };
  }
  try {
    const rekognition = new RekognitionClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    if (!DetectModerationLabelsCommand) {
      return { passed: true, blockedLabels: [] };
    }
    const result = (await rekognition.send(
      new DetectModerationLabelsCommand({
        Image: { S3Object: { Bucket: mediaBucket(), Name: s3Key } },
        MinConfidence: MODERATION_CONFIDENCE_THRESHOLD,
      }) as never,
    )) as {
      ModerationLabels?: Array<{ Name?: string; ParentName?: string; Confidence?: number }>;
    };
    const blocked = (result.ModerationLabels ?? [])
      .filter((l) => {
        const name = l.Name ?? "";
        const parent = l.ParentName ?? "";
        const conf = l.Confidence ?? 0;
        return (
          conf >= MODERATION_CONFIDENCE_THRESHOLD &&
          (BLOCKED_MODERATION_CATEGORIES.has(name) || BLOCKED_MODERATION_CATEGORIES.has(parent))
        );
      })
      .map((l) => l.Name ?? "")
      .filter(Boolean);
    return { passed: blocked.length === 0, blockedLabels: blocked };
  } catch (err: unknown) {
    console.warn(
      JSON.stringify({
        event: "sms_media_moderation_soft_fail",
        name: err instanceof Error ? err.name : "Error",
      }),
    );
    return { passed: true, blockedLabels: [] };
  }
}

async function detectSceneLabels(s3Key: string): Promise<string[]> {
  if (rekognitionMock() || !mediaBucket()) return [];
  try {
    const rekognition = new RekognitionClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const result = await rekognition.send(
      new DetectLabelsCommand({
        Image: { S3Object: { Bucket: mediaBucket(), Name: s3Key } },
        MaxLabels: 10,
        MinConfidence: 70,
      }),
    );
    return (result.Labels ?? [])
      .filter((l: { Confidence?: number }) => (l.Confidence ?? 0) >= 70)
      .map((l: { Name?: string }) => l.Name ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type SmsMediaProcessingResult = {
  accepted: ProcessedSmsMedia[];
  rejected: Array<{ index: number; reason: string }>;
};

export async function processInboundMedia(
  agencyId: string,
  phoneE164: string,
  msgId: string,
  mediaItems: MmsMediaItem[],
): Promise<SmsMediaProcessingResult> {
  const items = mediaItems.slice(0, LIMITS.maxItemsPerMessage);
  const accepted: ProcessedSmsMedia[] = [];
  const rejected: Array<{ index: number; reason: string }> = [];
  const bucket = mediaBucket();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const mediaType = classifyMediaType(item.contentType);
    let buffer: Buffer;
    let sizeBytes: number;
    try {
      ({ buffer, sizeBytes } = await downloadMedia(item.url));
    } catch (err: unknown) {
      rejected.push({ index: i, reason: "Could not retrieve your media. Please try again." });
      console.error(
        JSON.stringify({
          event: "sms_media_download_failed",
          idx: i,
          name: err instanceof Error ? err.name : "Error",
        }),
      );
      continue;
    }

    const validation = validateSmsMedia(mediaType, item.contentType, sizeBytes);
    if (!validation.valid) {
      rejected.push({ index: i, reason: validation.reason ?? "Invalid media" });
      continue;
    }

    if (!bucket) {
      rejected.push({ index: i, reason: "Media storage is not configured. You can still describe the issue." });
      continue;
    }

    let s3Key: string;
    try {
      s3Key = await uploadToS3(buffer, {
        agencyId,
        phoneE164,
        msgId,
        index: i,
        contentType: item.contentType,
      });
    } catch (err: unknown) {
      rejected.push({ index: i, reason: "Could not save your media. Please try again." });
      console.error(
        JSON.stringify({
          event: "sms_media_s3_failed",
          idx: i,
          name: err instanceof Error ? err.name : "Error",
        }),
      );
      continue;
    }

    let moderationPassed = true;
    let moderationLabels: string[] = [];
    let sceneLabels: string[] = [];

    if (mediaType === "IMAGE") {
      const mod = await moderateImage(s3Key);
      moderationPassed = mod.passed;
      moderationLabels = mod.blockedLabels;
      if (!moderationPassed) {
        await deleteFromS3(s3Key).catch(() => undefined);
        rejected.push({
          index: i,
          reason: "One of your images could not be accepted due to content restrictions.",
        });
        console.warn(JSON.stringify({ event: "sms_media_moderation_block", idx: i }));
        continue;
      }
      sceneLabels = await detectSceneLabels(s3Key);
    }

    const processed: ProcessedSmsMedia = {
      s3Key,
      s3Bucket: bucket,
      contentType: item.contentType,
      mediaType,
      fileSizeBytes: sizeBytes,
      moderationPassed,
      moderationLabels,
      sceneLabels,
    };
    await saveMediaRecord(agencyId, phoneE164, `${msgId}-${i}`, processed).catch((err: unknown) => {
      console.error(
        JSON.stringify({
          event: "sms_media_ddb_soft_fail",
          name: err instanceof Error ? err.name : "Error",
        }),
      );
    });
    accepted.push(processed);
  }

  return { accepted, rejected };
}

export function buildMediaAcknowledgment(
  accepted: ProcessedSmsMedia[],
  rejected: Array<{ index: number; reason: string }>,
  inferredCategory: string | null,
): string {
  const imageCount = accepted.filter((m) => m.mediaType === "IMAGE").length;
  const videoCount = accepted.filter((m) => m.mediaType === "VIDEO").length;
  const parts: string[] = [];

  if (accepted.length > 0) {
    const items: string[] = [];
    if (imageCount === 1) items.push("1 photo");
    if (imageCount > 1) items.push(`${imageCount} photos`);
    if (videoCount === 1) items.push("1 video");
    if (videoCount > 1) items.push(`${videoCount} videos`);
    parts.push(`Got your ${items.join(" and ")} — attached to your request.`);
  }
  if (rejected.length > 0) {
    parts.push(`Note: ${rejected[0]!.reason}`);
  }
  if (accepted.length > 0 && inferredCategory) {
    parts.push("What is the address or cross streets for this issue?");
  } else if (accepted.length > 0) {
    parts.push("What non-emergency issue are you reporting?");
  }
  return parts.join("\n");
}

export { inferCategoryFromSceneLabels };
