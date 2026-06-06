import { z } from "zod";

export const warRoomStatusSchema = z.enum(["active", "standby", "closed"]);
export type WarRoomStatus = z.infer<typeof warRoomStatusSchema>;

export const warRoomParticipantSchema = z.object({
  userId: z.string().min(1),
  role: z.string().min(1),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().optional(),
  active: z.boolean(),
});

export type WarRoomParticipant = z.infer<typeof warRoomParticipantSchema>;

export const warRoomSchema = z.object({
  roomId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  name: z.string().min(1).max(200),
  status: warRoomStatusSchema,
  createdBy: z.string().min(1),
  participants: z.array(warRoomParticipantSchema),
  pinnedNotes: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().optional(),
});

export type WarRoom = z.infer<typeof warRoomSchema>;

export const warRoomMessageSchema = z.object({
  messageId: z.string().min(1),
  roomId: z.string().min(1),
  agencyId: z.string().min(1),
  userId: z.string().min(1),
  userRole: z.string().min(1),
  content: z.string().min(1).max(4000),
  pinned: z.boolean(),
  createdAt: z.string().datetime(),
});

export type WarRoomMessage = z.infer<typeof warRoomMessageSchema>;

export const createWarRoomBodySchema = z.object({
  incidentId: z.string().min(1),
  name: z.string().min(1).max(200),
});

export type CreateWarRoomBody = z.infer<typeof createWarRoomBodySchema>;

export const postWarRoomMessageBodySchema = z.object({
  content: z.string().min(1).max(4000),
});

export type PostWarRoomMessageBody = z.infer<typeof postWarRoomMessageBodySchema>;

export const listWarRoomsQuerySchema = z.object({
  incidentId: z.string().min(1).optional(),
});

export const warRoomListResponseSchema = z.object({
  items: z.array(warRoomSchema),
});

export const warRoomMessagesResponseSchema = z.object({
  items: z.array(warRoomMessageSchema),
});
