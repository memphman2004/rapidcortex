import { z } from "zod";

export const callerChannelKindSchema = z.enum(["text", "photo", "video", "location", "dispatcher_text"]);
export type CallerChannelKind = z.infer<typeof callerChannelKindSchema>;

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const;

export const callerChannelTextBodySchema = z.object({
  kind: z.literal("text"),
  text: z.string().trim().min(1).max(500),
});

export const callerChannelLocationBodySchema = z.object({
  kind: z.literal("location"),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracyMeters: z.number().positive().max(50_000).optional(),
});

export const callerChannelUploadBodySchema = z.object({
  kind: z.enum(["photo", "video"]),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(80),
  byteSize: z.number().int().positive(),
});

export const callerChannelConfirmBodySchema = z.object({
  messageId: z.string().min(4).max(80),
});

export const dispatcherChannelReplySchema = z.object({
  text: z.string().trim().min(1).max(500),
});

export const callerChannelMessageSchema = z.object({
  messageId: z.string().min(4),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  sessionToken: z.string().min(8),
  kind: callerChannelKindSchema,
  from: z.enum(["caller", "dispatcher"]),
  text: z.string().max(500).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracyMeters: z.number().optional(),
  contentType: z.string().optional(),
  byteSize: z.number().int().optional(),
  s3Key: z.string().optional(),
  mediaStatus: z.enum(["pending", "ready"]).optional(),
  createdAt: z.string().min(20),
});
export type CallerChannelMessage = z.infer<typeof callerChannelMessageSchema>;

/** What the caller page may render. Coordinates and object keys stay off this payload. */
export const callerChannelPublicItemSchema = z.object({
  messageId: z.string(),
  kind: callerChannelKindSchema,
  from: z.enum(["caller", "dispatcher"]),
  text: z.string().optional(),
  mediaLabel: z.string().optional(),
  createdAt: z.string(),
});
export type CallerChannelPublicItem = z.infer<typeof callerChannelPublicItemSchema>;

export function toCallerChannelPublicItem(message: CallerChannelMessage): CallerChannelPublicItem | null {
  if (message.mediaStatus === "pending") return null;
  if (message.kind === "text" || message.kind === "dispatcher_text") {
    return {
      messageId: message.messageId,
      kind: message.kind,
      from: message.from,
      text: message.text,
      createdAt: message.createdAt,
    };
  }
  if (message.kind === "location") {
    return {
      messageId: message.messageId,
      kind: "location",
      from: "caller",
      mediaLabel: "Location shared",
      createdAt: message.createdAt,
    };
  }
  return {
    messageId: message.messageId,
    kind: message.kind,
    from: "caller",
    mediaLabel: message.kind === "photo" ? "Photo sent" : "Video sent",
    createdAt: message.createdAt,
  };
}

export function assertCallerMediaContentType(kind: "photo" | "video", contentType: string, byteSize: number): void {
  const allowed = kind === "photo" ? PHOTO_TYPES : VIDEO_TYPES;
  if (!(allowed as readonly string[]).includes(contentType)) {
    throw Object.assign(new Error("VALIDATION:File type is not allowed"), { statusCode: 400 });
  }
  const max = kind === "photo" ? 8 * 1024 * 1024 : 25 * 1024 * 1024;
  if (byteSize > max) {
    throw Object.assign(new Error("VALIDATION:File is too large"), { statusCode: 400 });
  }
}
