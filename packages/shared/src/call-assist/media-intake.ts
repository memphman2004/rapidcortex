/**
 * NEXiQ City Services — Media Intake
 *
 * Types and helpers for citizen-uploaded photo/document attachments.
 * Pre-signed S3 URL generation happens in the API layer; this module
 * provides the shared types, validation, and voice/SMS guidance.
 *
 * Account: 158961537080 (nexcortiq-prod). Never reference 621957412915.
 *
 * Gate: `config.mediaIntakeEnabled === true`.
 *       Submissions without media continue to work unchanged.
 *
 * Version: Phase 3 initial implementation.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Feature flag gate
// ---------------------------------------------------------------------------

export function isMediaIntakeEnabled(
  config: { mediaIntakeEnabled?: boolean } | null | undefined,
): boolean {
  return config?.mediaIntakeEnabled === true;
}

// ---------------------------------------------------------------------------
// Supported media types
// ---------------------------------------------------------------------------

export const MEDIA_INTAKE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "application/pdf",
] as const;

export type MediaIntakeMimeType = (typeof MEDIA_INTAKE_MIME_TYPES)[number];

export const MAX_MEDIA_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ---------------------------------------------------------------------------
// Attachment schema
// ---------------------------------------------------------------------------

export const mediaAttachmentSchema = z.object({
  /** S3 key within the agency media bucket. */
  s3Key: z.string().min(1).max(512),
  /** MIME type of the uploaded file. */
  mimeType: z.string().min(1).max(64),
  /** File size in bytes, if known. */
  sizeBytes: z.number().int().nonnegative().optional(),
  /** Original filename provided by the citizen. Sanitised before storage. */
  originalName: z.string().max(255).optional(),
  /** ISO 8601 datetime when the file was uploaded. */
  uploadedAt: z.string().min(1),
  /** Channel through which the media arrived. */
  channel: z.enum(["sms_mms", "web_form", "staff_upload", "open311"]),
});

export type MediaAttachment = z.infer<typeof mediaAttachmentSchema>;

// ---------------------------------------------------------------------------
// Pre-signed URL request / response types (wire format for the API layer)
// ---------------------------------------------------------------------------

export const mediaUploadRequestSchema = z.object({
  agencyId: z.string().min(1),
  confirmationNumber: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});

export type MediaUploadRequest = z.infer<typeof mediaUploadRequestSchema>;

export type MediaUploadResponse = {
  uploadUrl: string;
  s3Key: string;
  expiresAt: string; // ISO 8601
};

// ---------------------------------------------------------------------------
// S3 key structure
// ---------------------------------------------------------------------------

/**
 * Builds the S3 object key for a citizen media upload.
 * Pattern: `media/{agencyId}/{YYYY-MM}/{confirmationNumber}/{filename}`
 */
export function buildMediaS3Key(opts: {
  agencyId: string;
  confirmationNumber: string;
  filename: string;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const safe = sanitizeFilename(opts.filename);
  return `media/${opts.agencyId}/${month}/${opts.confirmationNumber}/${safe}`;
}

/** Strip unsafe characters from a user-provided filename. */
export function sanitizeFilename(filename: string): string {
  const ext = filename.includes(".")
    ? "." + filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  const base = filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "_")
    .slice(0, 60);
  return `${base}${ext}` || "upload";
}

// ---------------------------------------------------------------------------
// Voice / SMS guidance
// ---------------------------------------------------------------------------

export const MEDIA_INTAKE_SMS_PROMPT =
  "To attach a photo to your report, reply PHOTO to this message, then follow the link we send you.";

export const MEDIA_INTAKE_VOICE_PROMPT =
  "If you have a photo, you can text it to our SMS line and we'll attach it to your report.";

/** Returns the citizen-visible CDN URL for an uploaded attachment. */
export function mediaPublicUrl(opts: { cdnBase: string; s3Key: string }): string {
  return `${opts.cdnBase.replace(/\/$/, "")}/${opts.s3Key}`;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function isSupportedMimeType(mimeType: string): mimeType is MediaIntakeMimeType {
  return (MEDIA_INTAKE_MIME_TYPES as ReadonlyArray<string>).includes(mimeType);
}

export function isWithinSizeLimit(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_MEDIA_SIZE_BYTES;
}
