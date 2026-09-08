import { z } from "zod";

export const alsGeocodeResultSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  formattedAddress: z.string(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  confidence: z.number().min(0).max(1),
  provider: z.literal("amazon-location"),
});
export type AlsGeocodeResult = z.infer<typeof alsGeocodeResultSchema>;

export const alsGeocodeQuerySchema = z.object({
  address: z.string().trim().min(1).max(500),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export type AlsGeocodeQuery = z.infer<typeof alsGeocodeQuerySchema>;

export const alsReverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type AlsReverseGeocodeQuery = z.infer<typeof alsReverseGeocodeQuerySchema>;

export const alsRouteQuerySchema = z.object({
  fromLng: z.coerce.number().min(-180).max(180),
  fromLat: z.coerce.number().min(-90).max(90),
  toLng: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
});
export type AlsRouteQuery = z.infer<typeof alsRouteQuerySchema>;

export const alsRouteResultSchema = z.object({
  distanceMiles: z.number(),
  durationMinutes: z.number().int().min(0),
  geometry: z.array(z.tuple([z.number(), z.number()])),
  provider: z.literal("amazon-location"),
});
export type AlsRouteResult = z.infer<typeof alsRouteResultSchema>;

export const alsGeofenceUpsertBodySchema = z.object({
  zoneId: z.string().trim().min(1).max(80),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3).max(1000),
});
export type AlsGeofenceUpsertBody = z.infer<typeof alsGeofenceUpsertBodySchema>;

export const alsDevicePositionBodySchema = z.object({
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});
export type AlsDevicePositionBody = z.infer<typeof alsDevicePositionBodySchema>;

export const alsDevicePositionSchema = z.object({
  userId: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  lastUpdatedAt: z.string(),
});
export type AlsDevicePosition = z.infer<typeof alsDevicePositionSchema>;

/** ALS GeofenceId / DeviceId allow alphanumerics, hyphen, period, underscore. */
export function alsScopedId(agencyId: string, localId: string): string {
  const a = agencyId.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 40);
  const z = localId.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 50);
  return `${a}--${z}`.slice(0, 100);
}

export function alsAgencyPrefix(agencyId: string): string {
  return `${agencyId.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 40)}--`;
}
