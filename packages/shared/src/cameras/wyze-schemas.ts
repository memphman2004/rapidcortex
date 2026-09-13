import { z } from "zod";

export const wyzeRequestDurationMinutesSchema = z.union([
  z.literal(10),
  z.literal(30),
  z.literal(60),
  z.literal(120),
]);

export type WyzeRequestDurationMinutes = z.infer<typeof wyzeRequestDurationMinutesSchema>;

/** Public homeowner enrollment. agencyId is required and must match a real tenant. */
export const wyzeRegisterBodySchema = z
  .object({
    agencyId: z.string().min(1).max(120),
    email: z.string().email().max(320),
    phone: z.string().regex(/^\+1\d{10}$/, "Must be E.164 US number: +1XXXXXXXXXX"),
    keyId: z.string().min(1).max(200),
    apiKey: z.string().min(1).max(500),
    address: z.string().min(5).max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

export type WyzeRegisterBody = z.infer<typeof wyzeRegisterBodySchema>;

export const wyzeRequestCameraAccessBodySchema = z
  .object({
    incidentId: z.string().min(1).max(120),
    mac: z.string().min(1).max(200),
    requestedDurationMinutes: wyzeRequestDurationMinutesSchema,
  })
  .strict();

export type WyzeRequestCameraAccessBody = z.infer<typeof wyzeRequestCameraAccessBodySchema>;

export const wyzeAnswerStreamBodySchema = z
  .object({
    incidentId: z.string().min(1).max(120),
    mac: z.string().min(1).max(200),
  })
  .strict();

export type WyzeAnswerStreamBody = z.infer<typeof wyzeAnswerStreamBodySchema>;
