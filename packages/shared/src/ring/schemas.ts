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

export const ringDeviceToggleBodySchema = z.object({
  isEnabledForConnect: z.boolean(),
});

export type RingDeviceToggleBody = z.infer<typeof ringDeviceToggleBodySchema>;

/** Appstore Account Link URL — homeowner sign-in/up + nonce claim (after Ring Sign in). */
export const ringHomeownerLinkBodySchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(256),
  mode: z.enum(["signin", "signup"]).default("signin"),
  nonce: z.string().min(8).max(256),
  time: z.string().regex(/^\d{13}$/, "time must be Unix epoch milliseconds"),
});

export type RingHomeownerLinkBody = z.infer<typeof ringHomeownerLinkBodySchema>;

/** Request a Cognito reset code for a Ring device-owner Rapid Cortex account. */
export const ringHomeownerForgotPasswordBodySchema = z.object({
  email: z.string().email().max(320),
});

export type RingHomeownerForgotPasswordBody = z.infer<typeof ringHomeownerForgotPasswordBodySchema>;

/** Confirm Cognito forgot-password with email code + new password. */
export const ringHomeownerConfirmForgotPasswordBodySchema = z.object({
  email: z.string().email().max(320),
  code: z.string().min(4).max(32),
  newPassword: z.string().min(12).max(256),
});

export type RingHomeownerConfirmForgotPasswordBody = z.infer<
  typeof ringHomeownerConfirmForgotPasswordBodySchema
>;
