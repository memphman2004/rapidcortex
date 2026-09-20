import { z } from "zod";

export const guestAssistVerticalSchema = z.enum(["venue", "campus", "transit"]);
export type GuestAssistVertical = z.infer<typeof guestAssistVerticalSchema>;

export const guestAssistChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const guestAssistChatBodySchema = z.object({
  system: z.string().min(1).max(8000),
  messages: z.array(guestAssistChatMessageSchema).min(1).max(40),
  vertical: guestAssistVerticalSchema,
  name: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
});
export type GuestAssistChatBody = z.infer<typeof guestAssistChatBodySchema>;

export const guestAssistSessionBodySchema = z.object({
  vertical: guestAssistVerticalSchema,
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  agencyId: z.string().max(128).optional(),
});
export type GuestAssistSessionBody = z.infer<typeof guestAssistSessionBodySchema>;

export const guestAssistAlertBodySchema = z.object({
  vertical: guestAssistVerticalSchema,
  name: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  agencyId: z.string().max(128).optional(),
});
export type GuestAssistAlertBody = z.infer<typeof guestAssistAlertBodySchema>;

export type GuestAssistTokenPayload = {
  sid: string;
  v: GuestAssistVertical;
  loc: string;
  name: string;
  agencyId: string;
  exp: number;
};
