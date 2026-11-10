import { z } from "zod";

export const callerLocationSourceSchema = z.enum(["gps", "wifi", "cell", "manual"]);
export type CallerLocationSource = z.infer<typeof callerLocationSourceSchema>;

export const postCallerLocationBodySchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100_000),
    heading: z.number().min(0).max(360).optional(),
    speed: z.number().min(0).optional(),
    source: callerLocationSourceSchema,
    timestamp: z.string().datetime({ offset: true }).or(z.string().min(1)),
  })
  .strict();
export type PostCallerLocationBody = z.infer<typeof postCallerLocationBodySchema>;

export const callerLocationEntrySchema = z.object({
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number(),
  heading: z.number().optional(),
  speed: z.number().optional(),
  source: callerLocationSourceSchema,
  timestamp: z.string().min(1),
  ttl: z.number().int().optional(),
});
export type CallerLocationEntry = z.infer<typeof callerLocationEntrySchema>;

export const listCallerLocationsResponseSchema = z.object({
  items: z.array(callerLocationEntrySchema),
});
export type ListCallerLocationsResponse = z.infer<typeof listCallerLocationsResponseSchema>;
