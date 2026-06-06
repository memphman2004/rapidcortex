import { z } from "zod";

export const ringRequestDurationMinutesSchema = z.union([
  z.literal(10),
  z.literal(30),
  z.literal(60),
  z.literal(120),
]);

export type RingRequestDurationMinutesInput = z.infer<typeof ringRequestDurationMinutesSchema>;

export const ringRequestCameraAccessBodySchema = z.object({
  incidentId: z.string().min(1),
  deviceId: z.string().min(1),
  requestedDurationMinutes: ringRequestDurationMinutesSchema,
});

export type RingRequestCameraAccessBody = z.infer<typeof ringRequestCameraAccessBodySchema>;

export const ringRevokeCameraAccessBodySchema = z.object({
  revokeToken: z.string().min(1).optional(),
});

export type RingRevokeCameraAccessBody = z.infer<typeof ringRevokeCameraAccessBodySchema>;
