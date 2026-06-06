import { z } from "zod";

export const callerMediaTypeSchema = z.enum(["photo", "video", "both"]);
export type CallerMediaType = z.infer<typeof callerMediaTypeSchema>;

export const callerMediaSendLinkBodySchema = z.object({
  callerPhone: z
    .string()
    .min(8)
    .max(24)
    .regex(/^\+[1-9]\d{6,22}$/, "Use E.164 format with leading +"),
  mediaType: callerMediaTypeSchema,
});
export type CallerMediaSendLinkBody = z.infer<typeof callerMediaSendLinkBodySchema>;

export const callerMediaUploadUrlBodySchema = z.object({
  mediaType: z.enum(["photo", "video"]),
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(3).max(120),
});
export type CallerMediaUploadUrlBody = z.infer<typeof callerMediaUploadUrlBodySchema>;

export type CallerMediaUploadUrlResponse = {
  uploadUrl: string;
  mediaId: string;
  expiresAt: string;
};

export type CallerMediaSendLinkResponse = {
  sent: boolean;
  linkExpiresAt: string;
  mediaId: string;
};
